import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { randomUUID } from 'crypto';
import * as os from 'os';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';

const prisma = new PrismaClient();
const dummyDir = path.join(__dirname, 'dummy-data');
const sampleDir = path.join(__dirname, '..', 'public', 'assets', 'images');
const placeholderPdf = path.join(sampleDir, 'certificate.pdf');

// Helper sanitizers
const toInt = (v: any): number | null => {
  if (v === '' || v === undefined || v === null) return null;
  const n = parseInt(v as string, 10);
  return isNaN(n) ? null : n;
};
const toFloat = (v: any): number | null => {
  if (v === '' || v === undefined || v === null) return null;
  const f = parseFloat(v as string);
  return isNaN(f) ? null : f;
};
const toBool = (v: any): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['true','t','1','yes','y'].includes(v.toLowerCase());
  return false;
};
const toDateObj = (d: string | null): Date | null => {
  if (!d || d.trim() === '') return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(dummyDir, file), 'utf8')) as T;
}

async function seedRoles() {
  console.log('--- Seeding roles ---');
  const raw: any[] = loadJson('roles.json');

  // Normalize to array of objects with optional id & name
  const data = raw.map((r) => {
    if (typeof r === 'string') {
      return { name: r };
    }
    // Example dump shape: { id: 'uuid', name: 'super admin' } or maybe ['uuid','super admin']
    if (Array.isArray(r) && r.length >= 2) {
      return { id: r[0], name: r[1] };
    }
    return { id: r.id ?? undefined, name: r.name ?? r }; // fallback
  });

  await prisma.role.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} roles.`);
}

async function seedParticipants() {
  console.log('--- Seeding participants (using stream for large file) ---');
  const participantsPath = path.join(dummyDir, 'participants.json');
  const batchSize = 200;
  let batch: any[] = [];

  const processBatch = async (items: any[]) => {
    if (items.length === 0) return;
    
    const localIp = Object.values(os.networkInterfaces()).flat().find((x) => x?.family === 'IPv4' && !x.internal)?.address ?? 'localhost';

    await Promise.all(items.map(async (p) => {
      // Sanitize: empty string or undefined -> null
      for (const key in p) {
        if (p[key] === '' || p[key] === undefined) p[key] = null;
      }

      // Convert ISO date strings (yyyy-mm-dd) to Date objects
      const toDate = (d: string | null): Date | null => {
        if (!d || d.trim() === '') return null;
        const date = new Date(`${d}T00:00:00Z`);
        return isNaN(date.getTime()) ? null : date;
      };
      ['tglKeluarSuratBebasNarkoba', 'tglKeluarSuratSehatButaWarna', 'dateOfBirth'].forEach((field) => {
        p[field] = toDate(p[field]);
      });

      const img = (fileName: string | null) => {
        const filePath = fileName ? path.join(sampleDir, fileName) : null;
        return filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
      };
      p.simA = img(p.simAFileName);
      p.simB = img(p.simBFileName);
      p.ktp = img(p.ktpFileName);
      p.foto = img(p.fotoFileName);
      p.suratBebasNarkoba = img(p.suratBebasNarkobaFileName);
      p.suratSehatButaWarna = img(p.suratSehatButaWarnaFileName);

      const url = `http://${localIp}:4200/participant/detail/${p.id}`;
      const qrDataUrl = await QRCode.toDataURL(url);
      p.qrCode = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    }));

    try {
      await prisma.participant.createMany({
        data: items,
        skipDuplicates: true,
      });
      console.log(`✔ Inserted batch of ${items.length} participants.`);
    } catch (e) {
      console.error('⚠ Failed inserting participant batch, logging to failed_participants.json');
      fs.appendFileSync('failed_participants.json', JSON.stringify(items, null, 2) + ',\n');
    }
  };

  const pipeline = chain([
    fs.createReadStream(participantsPath),
    parser(),
    streamArray(),
  ]);

  for await (const data of pipeline) {
    batch.push(data.value);
    if (batch.length >= batchSize) {
      try {
        await processBatch(batch);
      } catch (e) {
        console.error('⚠ Failed processing a batch. Logging items to failed_batch_processing.json and continuing...', e);
        fs.appendFileSync('failed_batch_processing.json', JSON.stringify(batch, null, 2) + ',\n');
      }
      batch = []; // Clear the batch
    }
  }

  if (batch.length > 0) {
    try {
      await processBatch(batch);
    } catch (e) {
      console.error('⚠ Failed processing the final batch. Logging items to failed_batch_processing.json.', e);
      fs.appendFileSync('failed_batch_processing.json', JSON.stringify(batch, null, 2) + ',\n');
    }
  }
  console.log('--- Finished seeding participants ---');
}

async function seedUsers() {
  console.log('--- Seeding users ---');
  interface U { email: string; idNumber?: string; name: string; password: string; role: string; participantId?: string | null; dinas?: string | null }

  // 1. Ensure core roles exist (they should be from seedRoles, but safeguard)
  const coreRoles = ['super admin','supervisor','lcu','user'];
  await prisma.role.createMany({
    data: coreRoles.map((n) => ({ name: n })),
    skipDuplicates: true,
  });

  const roles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(roles.map((r) => [r.name.toLowerCase(), r.id]));

  // 2. Seed default privileged accounts so we have predictable logins
  const dinasList = ['TA','TB','TC','TF','TJ','TL','TM','TR','TU','TV','TZ'];
  const hash = (pwd: string) => bcrypt.hash(pwd, 10);

  // helpers
  const upsertUser = async (u: Partial<U> & { passwordPlain: string; role: string }) => {
    const pwdHashed = await hash(u.passwordPlain);
    await prisma.user.upsert({
      where: { email: u.email! },
      create: {
        email: u.email!,
        idNumber: u.idNumber ?? null,
        name: u.name ?? u.email!,
        password: pwdHashed,
        roleId: roleMap[u.role.toLowerCase()],
        participantId: u.participantId ?? null,
        dinas: u.dinas ?? null,
        verifiedAccount: true,
      },
      update: {
        password: pwdHashed,
        roleId: roleMap[u.role.toLowerCase()],
        dinas: u.dinas ?? undefined,
      },
    });
  };

  // Super Admins
  for (let i = 1; i <= 5; i++) {
    await upsertUser({
      email: `superadmin${i}@example.com`,
      idNumber: `SA${i.toString().padStart(3,'0')}`,
      name: `Super Admin ${i}`,
      passwordPlain: 'Admin12345',
      role: 'super admin',
    });
  }

  // Supervisors
  for (let i = 1; i <= 5; i++) {
    await upsertUser({
      email: `supervisor${i}@example.com`,
      idNumber: `SP${i.toString().padStart(3,'0')}`,
      name: `Supervisor ${i}`,
      dinas: dinasList[i-1],
      passwordPlain: 'Supervisor12345',
      role: 'supervisor',
    });
  }

  // LCUs (11)
  for (let i = 1; i <= 11; i++) {
    await upsertUser({
      email: `lcu${i}@example.com`,
      idNumber: `LCU${i.toString().padStart(3,'0')}`,
      name: `LCU ${i}`,
      dinas: dinasList[i-1],
      passwordPlain: 'Lcu12345',
      role: 'lcu',
    });
  }

  // Participants as standard users (pick first 30 participants)
  const firstParticipants = await prisma.participant.findMany({ take: 30 });
  for (let idx = 0; idx < firstParticipants.length; idx++) {
    const p = firstParticipants[idx];
    await upsertUser({
      email: p.email ?? `participant${idx+1}@example.com`,
      idNumber: p.idNumber ?? undefined,
      name: p.name,
      participantId: p.id,
      dinas: p.dinas ?? null,
      passwordPlain: 'User12345',
      role: 'user',
    });
  }

  // 3. Seed any remaining users from users.json (mostly historic dump)
  // Gather idNumbers already used to avoid unique constraint errors
  const existingIds = await prisma.user.findMany({ select: { idNumber: true } });
  const usedIdNumbers = new Set(existingIds.map((r) => r.idNumber).filter(Boolean) as string[]);

  const bcryptRegex = /^\$2[aby]\$/;
  const usersFromJson: U[] = loadJson('users.json');
  for (const u of usersFromJson) {
    const passwordToStore = bcryptRegex.test(u.password)
      ? u.password // already hashed
      : await bcrypt.hash(u.password, 10);

    // ensure idNumber uniqueness
    let idNumberToUse: string | null = u.idNumber ?? null;
    if (idNumberToUse && usedIdNumbers.has(idNumberToUse)) {
      idNumberToUse = null; // duplicate, skip
    }
    if (idNumberToUse) usedIdNumbers.add(idNumberToUse);

    await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // keep existing
      create: {
        email: u.email,
        idNumber: idNumberToUse,
        name: u.name,
        password: passwordToStore,
        roleId: roleMap[(u.role || 'user').toLowerCase()],
        participantId: u.participantId ?? null,
        verifiedAccount: true,
      },
    });
  }

  // Log summary
  const [{ count }] = await prisma.$queryRawUnsafe<{ count: string }[]>(`SELECT count(*) FROM "users"`);
  console.log(`✔ Users table now has ${count} rows.`);
}


async function seedCapabilities() {
  console.log('--- Seeding capabilities ---');
  const raw: any[] = loadJson('capabilities.json');

  const numFields = [
    'totalDuration',
    'totalPracticeDurationCompetency',
    'totalPracticeDurationRegGse',
    'totalTheoryDurationCompetency',
    'totalTheoryDurationRegGse',
  ];

  const data = raw.map((c) => {
    const item: any = { ...c };
    for (const f of numFields) {
      if (item[f] === '' || item[f] === undefined) {
        item[f] = null;
      } else if (typeof item[f] === 'string') {
        const n = parseInt(item[f], 10);
        item[f] = isNaN(n) ? null : n;
      }
    }
    return item;
  });

  await prisma.capability.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} capabilities.`);
}

async function seedCots() {
  console.log('--- Seeding COTs ---');
  const raw: any[] = loadJson('cots.json');
  const data = raw.map((c) => ({
    id: c.id,
    startDate: toDateObj(c.startDate) ?? new Date(),
    endDate: toDateObj(c.endDate) ?? new Date(),
    trainingLocation: c.trainingLocation ?? 'N/A',
    theoryInstructorRegGse: c.theoryInstructorRegGse ?? 'N/A',
    theoryInstructorCompetency: c.theoryInstructorCompetency ?? 'N/A',
    practicalInstructor1: c.practicalInstructor1 ?? 'N/A',
    practicalInstructor2: c.practicalInstructor2 ?? 'N/A',
    status: c.status ?? 'pending',
  }));
  await prisma.cOT.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} cots.`);
}

async function seedCapabilityCots() {
  console.log('--- Seeding capabilityCots ---');
  const raw: any[] = loadJson('capabilitycots.json');
  let data = raw.map((r) => ({ capabilityId: r.capabilityId ?? r[0], cotId: r.cotId ?? r[1] }));

  if (data.length === 0) {
    console.warn('- No capabilityCots data found, generating dummy links');
    const [caps, cots] = await Promise.all([
      prisma.capability.findMany(),
      prisma.cOT.findMany(),
    ]);
    // Simple pairing: link each capability to every COT
    data = caps.flatMap((cap) => cots.map((c) => ({ capabilityId: cap.id, cotId: c.id })));
  }

  if (data.length > 0) await prisma.capabilityCOT.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} capabilityCots.`);
}

async function seedSignatures() {
  console.log('--- Seeding signatures ---');
  // Clear existing signatures to avoid leftover placeholder data
  await prisma.signature.deleteMany();
  const raw: any[] = loadJson('signatures.json');
  let data = raw.map((s) => {
    // Determine which image file to use
    const sigType = (s.signatureType ?? 'SIGNATURE1').toString();
    // Choose default image based on signature type
    const defaultName = sigType === 'SIGNATURE2' ? 'e-sign2.png' : 'e-sign1.png';

    let fileBase = s.eSignFileName ?? defaultName;
    let absPath = path.join(sampleDir, fileBase);

    // Provided file missing? fallback to defaultName
    if (!fs.existsSync(absPath)) {
      fileBase = defaultName;
      absPath = path.join(sampleDir, fileBase);
    }

    const eSignBuf: Buffer = fs.existsSync(absPath)
      ? fs.readFileSync(absPath)
      : Buffer.from('');
    return {
      id: s.id,
      idNumber: s.idNumber ?? '0000',
      role: s.role ?? 'user',
      name: s.name ?? 'Unknown',
      eSign: eSignBuf,
      eSignFileName: fileBase,
      signatureType: s.signatureType ?? 'SIGNATURE1',
      status: toBool(s.status),
    };
  });

  if (data.length === 0) {
    console.warn('- No signatures data found, generating dummy signatures');
    const dummyFiles = ['e-sign1.png','e-sign2.png'];
    data = dummyFiles.map((f, idx) => {
      const abs = path.join(sampleDir, f);
      return {
        id: randomUUID(),
        idNumber: `D${idx + 1}`,
        role: idx === 0 ? 'Manager' : 'Supervisor',
        name: idx === 0 ? 'Dummy Signer 1' : 'Dummy Signer 2',
        eSign: fs.existsSync(abs) ? fs.readFileSync(abs) : Buffer.from(''),
        eSignFileName: f,
        signatureType: idx === 0 ? 'SIGNATURE1' : 'SIGNATURE2',
        status: true,
      };
    });
  }

  if (data.length > 0) await prisma.signature.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} signatures.`);
}

async function seedCertificates() {
  console.log('--- Seeding certificates ---');
  const raw: any[] = loadJson('certificates.json');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let data = raw
    .filter((c) => {
      const sig = c.signatureId ?? c[6];
      const cot = c.cotId ?? c[5];
      return uuid.test(sig) && uuid.test(cot);
    })
    .map((c) => ({
      id: c.id,
      cotId: c.cotId ?? c[5],
      signatureId: c.signatureId ?? c[6],
      certificateNumber: c.certificateNumber ?? 'N/A',
      attendance: toBool(c.attendance),
      theoryScore: toFloat(c.theoryScore) ?? 0,
      practiceScore: toFloat(c.practiceScore) ?? 0,
    }));

  // If no valid records, generate dummy certificates (one per COT)
  if (data.length === 0) {
    console.warn('- No valid certificate entries found, generating dummy data');
    const [cots, signatures] = await Promise.all([
      prisma.cOT.findMany(),
      prisma.signature.findMany({ take: 1 }),
    ]);
    const sigId = signatures[0]?.id ?? randomUUID();
    data = cots.map((c) => ({
      id: randomUUID(),
      cotId: c.id,
      signatureId: sigId,
      certificateNumber: `CERT-${c.id.substring(0, 6).toUpperCase()}`,
      attendance: true,
      theoryScore: 80,
      practiceScore: 85,
    }));
  }

  if (data.length > 0) await prisma.certificate.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} certificates.`);
}

async function seedParticipantsCot() {
  console.log('--- Seeding participantsCot ---');
  const raw: any[] = loadJson('participantscot.json');
  let data = raw.map((r) => ({ id: r.id, participantId: r.participantId ?? r[0], cotId: r.cotId ?? r[1] }));

  if (data.length === 0) {
    console.warn('- No participantsCot data found, generating dummy links');
    const [participants, cots] = await Promise.all([
      prisma.participant.findMany({ take: 20 }), // limit to 20 for sample
      prisma.cOT.findMany(),
    ]);
    // Round-robin assign participants to cots
    data = participants.map((p, idx) => ({
      id: randomUUID(),
      participantId: p.id,
      cotId: cots[idx % cots.length].id,
    }));
  }

  if (data.length > 0) await prisma.participantsCOT.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} participantsCot.`);
}

async function seedCurriculumSyllabus() {
  console.log('--- Seeding curriculumSyllabus ---');
  const raw: any[] = loadJson('curriculumsyllabus.json');
  let data = raw.map((r) => ({
    id: r.id,
    capabilityId: r.capabilityId ?? r[0],
    name: r.name ?? 'N/A',
    theoryDuration: toInt(r.theoryDuration) ?? 0,
    practiceDuration: toInt(r.practiceDuration) ?? 0,
    type: r.type ?? 'REGULAR',
  }));

  if (data.length === 0) {
    console.warn('- No curriculumSyllabus data found, generating dummy syllabus');
    const caps = await prisma.capability.findMany();
    data = caps.map((c) => ({
      id: randomUUID(),
      capabilityId: c.id,
      name: `${c.trainingName} - Intro`,
      theoryDuration: 2,
      practiceDuration: 3,
      type: 'REGULAR',
    }));
  }

  if (data.length > 0) await prisma.curriculumSyllabus.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} curriculumSyllabus.`);
}

async function main() {
  try {
    await seedRoles();
    await seedCapabilities();
    await seedCots();
    await seedCapabilityCots();
    await seedSignatures();
    await seedCertificates();
    await seedParticipants();
    await seedParticipantsCot();
    await seedUsers();
    await seedCurriculumSyllabus();

    // Post-processing: ensure User.dinas mirrors linked Participant.dinas when null
    await prisma.$executeRawUnsafe(
      'UPDATE "users" u SET "dinas" = p."dinas" FROM "participants" p WHERE p."id" = u."participantId" AND u."dinas" IS NULL;'
    );

    console.log('\n✅ Seed completed successfully!');

    // Quick row counts
    const tablesToCheck = ['roles','capabilities','cots','signatures','participants','users','capabilityCots','participantsCot','certificates','curriculumSyllabus'];
    for (const t of tablesToCheck) {
      const [{ count }] = await prisma.$queryRawUnsafe<{ count: string }[]>(`SELECT count(*) FROM "${t}"`);
      console.log(`${t}: ${count} rows`);
    }
  } catch (e) {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
main();
