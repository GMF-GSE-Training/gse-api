import { PrismaClient, SignatureType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { randomUUID } from 'crypto';
import * as os from 'os';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { faker } from '@faker-js/faker';
import { Client as MinioClient } from 'minio';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const dummyDir = path.join(__dirname, 'dummy-data');
const sampleDir = path.join(__dirname, '..', 'public', 'assets', 'images');
const placeholderPdf = path.join(sampleDir, 'certificate.pdf');

// Daftar file aset yang akan digunakan
const predefinedFiles = {
  foto: 'foto.jpg',
  ktp: 'ktp.jpg',
  simA: 'SIM_A.jpg',
  simB: 'SIM_B.jpg',
  suratSehatButaWarna: 'surat_ket_sehat.jpg',
  suratBebasNarkoba: 'surat_bebas_narkoba.jpg',
};

// Inisialisasi Minio Client
const minio = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: Number(process.env.MINIO_PORT!),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});
const minioBucket = process.env.MINIO_BUCKET!;

async function uploadToMinio(localPath: string, destName: string): Promise<string> {
  if (!fs.existsSync(localPath)) return '';
  await minio.fPutObject(minioBucket, destName, localPath);
  return destName;
}

// Fungsi pembantu untuk memuat buffer aset
const loadAssetBuffer = (fileName: string, defaultBuffer?: Buffer): Buffer | null => {
  if (!fileName) return defaultBuffer || null;
  const filePath = path.join(sampleDir, fileName);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : defaultBuffer || null;
};

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

function loadJson<T>(file: string): T[] {
  const filePath = path.join(dummyDir, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`- Dummy data file not found: ${file}. Returning empty array.`);
    return [] as T[];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T[];
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
  console.log('--- Seeding participants ---');
  const participantsPath = path.join(dummyDir, 'participants.json');
  let rawParticipants: any[] = [];

  // Muat data dari participants.json jika ada
  if (fs.existsSync(participantsPath)) {
    const pipeline = chain([
      fs.createReadStream(participantsPath),
      parser(),
      streamArray(),
    ]);
    for await (const data of pipeline) {
      rawParticipants.push(data.value);
    }
  }

  // Jika tidak ada data JSON, buat data dummy
  if (rawParticipants.length === 0) {
    console.warn('- Dummy data file not found or empty: participants.json. Generating dummy participants.');
    for (let i = 0; i < 50; i++) {
      const gender = faker.helpers.arrayElement(['male', 'female']) as 'male' | 'female';
      const name = faker.person.fullName({ sex: gender });
      const email = faker.internet.email({ firstName: faker.person.firstName(gender), lastName: faker.person.lastName(gender) }).toLowerCase();
      const nik = faker.string.numeric(16);
      const phoneNumber = faker.phone.number('08##########');
      const idNumber = `P${(i + 1).toString().padStart(3, '0')}`;
      const dinas = faker.helpers.arrayElement(['TA', 'TB', 'TC', 'TF', 'TJ', 'TL', 'TM', 'TR', 'TU', 'TV', 'TZ']);

      rawParticipants.push({
        id: faker.string.uuid(),
        idNumber,
        name,
        nik,
        dinas,
        bidang: faker.commerce.department(),
        company: faker.company.name(),
        email,
        phoneNumber,
        nationality: 'Indonesia',
        placeOfBirth: faker.location.city(),
        dateOfBirth: faker.date.past({ years: 30, refDate: '2000-01-01' }).toISOString().split('T')[0],
        simAFileName: predefinedFiles.simA,
        simBFileName: predefinedFiles.simB,
        ktpFileName: predefinedFiles.ktp,
        fotoFileName: predefinedFiles.foto,
        suratSehatButaWarnaFileName: predefinedFiles.suratSehatButaWarna,
        tglKeluarSuratSehatButaWarna: null,
        suratBebasNarkobaFileName: predefinedFiles.suratBebasNarkoba,
        tglKeluarSuratBebasNarkoba: null,
        gmfNonGmf: faker.helpers.arrayElement(['GMF', 'Non-GMF']),
      });
    }
  }

  if (rawParticipants.length === 0) {
    console.log('No participants to seed.');
    return;
  }

  const localIp = Object.values(os.networkInterfaces()).flat().find((x) => x?.family === 'IPv4' && !x.internal)?.address ?? 'localhost';
  const defaultPhotoBuffer = loadAssetBuffer('blank-profile-picture.png');

  const dataToSeed = await Promise.all(rawParticipants.map(async (p) => {
    // Override nama file dengan aset yang ditentukan
    p.fotoFileName = predefinedFiles.foto;
    p.ktpFileName = predefinedFiles.ktp;
    p.simAFileName = predefinedFiles.simA;
    p.simBFileName = predefinedFiles.simB;
    p.suratSehatButaWarnaFileName = predefinedFiles.suratSehatButaWarna;
    p.suratBebasNarkobaFileName = predefinedFiles.suratBebasNarkoba;

    // Sanitasi data
    for (const key in p) {
      if (p[key] === '' || p[key] === undefined) p[key] = null;
    }

    // Konversi tanggal
    const toDate = (d: string | null): Date | null => {
      if (!d || d.trim() === '') return null;
      const date = new Date(`${d}T00:00:00Z`);
      return isNaN(date.getTime()) ? null : date;
    };
    ['tglKeluarSuratBebasNarkoba', 'tglKeluarSuratSehatButaWarna', 'dateOfBirth'].forEach((field) => {
      p[field] = toDate(p[field]);
    });

    // Upload file ke Minio dan simpan path
    p.fotoPath = await uploadToMinio(path.join(sampleDir, p.fotoFileName), `foto/${p.id}.jpg`);
    p.ktpPath = await uploadToMinio(path.join(sampleDir, p.ktpFileName), `ktp/${p.id}.jpg`);
    p.simAPath = await uploadToMinio(path.join(sampleDir, p.simAFileName), `simA/${p.id}.jpg`);
    p.simBPath = await uploadToMinio(path.join(sampleDir, p.simBFileName), `simB/${p.id}.jpg`);
    p.suratSehatButaWarnaPath = await uploadToMinio(path.join(sampleDir, p.suratSehatButaWarnaFileName), `suratSehat/${p.id}.jpg`);
    p.suratBebasNarkobaPath = await uploadToMinio(path.join(sampleDir, p.suratBebasNarkobaFileName), `suratNarkoba/${p.id}.jpg`);

    // QR code (generate, simpan sebagai file, upload ke Minio, simpan path)
    const frontendUrl = process.env.FRONTEND_URL || `http://${localIp}:4200`;
    const url = `${frontendUrl}/participant/detail/${p.id}`;
    const qrDataUrl = await QRCode.toDataURL(url);
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const qrTempPath = path.join(os.tmpdir(), `qr_${p.id}.png`);
    fs.writeFileSync(qrTempPath, qrBuffer);
    p.qrCodePath = await uploadToMinio(qrTempPath, `qrcode/${p.id}.png`);
    fs.unlinkSync(qrTempPath);

    // Hapus field buffer agar tidak error
    delete p.foto;
    delete p.ktp;
    delete p.simA;
    delete p.simB;
    delete p.suratSehatButaWarna;
    delete p.suratBebasNarkoba;
    delete p.qrCode;

    return p;
  }));

  try {
    await prisma.participant.createMany({
      data: dataToSeed,
      skipDuplicates: true,
    });
    console.log(`✔ Seeded ${dataToSeed.length} participants.`);
  } catch (e) {
    console.error('⚠ Failed inserting participant batch, logging to failed_participants.json');
    fs.appendFileSync('failed_participants.json', JSON.stringify(dataToSeed, null, 2) + ',\n');
  }
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
  let data: any[] = [];

  if (raw.length === 0) {
    console.warn('- No capabilities data found, generating dummy data');
    // Generate some dummy capabilities
    for (let i = 0; i < 10; i++) { // Generate 10 dummy capabilities
      data.push({
        id: faker.string.uuid(),
        ratingCode: `RC${(i + 1).toString().padStart(2, '0')}`,
        trainingCode: `TC${(i + 1).toString().padStart(3, '0')}`,
        trainingName: faker.lorem.words({ min: 2, max: 5 }),
        totalTheoryDurationRegGse: faker.number.int({ min: 10, max: 100 }),
        totalPracticeDurationRegGse: faker.number.int({ min: 10, max: 100 }),
        totalTheoryDurationCompetency: faker.number.int({ min: 10, max: 100 }),
        totalPracticeDurationCompetency: faker.number.int({ min: 10, max: 100 }),
        totalDuration: faker.number.int({ min: 50, max: 500 }),
      });
    }
  } else {
  const numFields = [
    'totalDuration',
    'totalPracticeDurationCompetency',
    'totalPracticeDurationRegGse',
    'totalTheoryDurationCompetency',
    'totalTheoryDurationRegGse',
  ];

    data = raw.map((c) => {
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
  }

  await prisma.capability.createMany({ data, skipDuplicates: true });
  console.log(`✔ Seeded ${data.length} capabilities.`);
}

async function seedCots() {
  console.log('--- Seeding COTs ---');
  const raw: any[] = loadJson('cots.json');
  let data: any[] = [];

  if (raw.length === 0) {
    console.warn('- No COTs data found, generating dummy data');
    // Generate some dummy COTs
    for (let i = 0; i < 5; i++) { // Generate 5 dummy COTs
      data.push({
        id: faker.string.uuid(),
        startDate: faker.date.recent({ days: 30 }),
        endDate: faker.date.future({ years: 1, refDate: faker.date.recent({ days: 30 }) }),
        trainingLocation: faker.location.city(),
        theoryInstructorRegGse: faker.person.fullName(),
        theoryInstructorCompetency: faker.person.fullName(),
        practicalInstructor1: faker.person.fullName(),
        practicalInstructor2: faker.person.fullName(),
        status: faker.helpers.arrayElement(['Menunggu', 'Berlangsung', 'Selesai']),
      });
    }
  } else {
    data = raw.map((c) => ({
    id: c.id,
    startDate: toDateObj(c.startDate) ?? new Date(),
    endDate: toDateObj(c.endDate) ?? new Date(),
    trainingLocation: c.trainingLocation ?? 'N/A',
    theoryInstructorRegGse: c.theoryInstructorRegGse ?? 'N/A',
    theoryInstructorCompetency: c.theoryInstructorCompetency ?? 'N/A',
    practicalInstructor1: c.practicalInstructor1 ?? 'N/A',
    practicalInstructor2: c.practicalInstructor2 ?? 'N/A',
    status: c.status ?? 'Menunggu',
  }));
  }

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
  console.log('- Creating signatures directly from asset files, ignoring signatures.json.');
  const signaturesToCreate = [
    {
      id: randomUUID(),
      idNumber: 'SIGNER001',
      role: 'Manager',
      name: 'Manager Signatory',
      eSignFileName: 'e-sign1.png',
      signatureType: SignatureType.SIGNATURE1,
      status: true,
      eSignPath: '',
    },
    {
      id: randomUUID(),
      idNumber: 'SIGNER002',
      role: 'Supervisor',
      name: 'Supervisor Signatory',
      eSignFileName: 'e-sign2.png',
      signatureType: SignatureType.SIGNATURE2,
      status: true,
      eSignPath: '',
    },
  ];
  const data = await Promise.all(signaturesToCreate.map(async (s) => {
    const localPath = path.join(sampleDir, s.eSignFileName);
    const eSignPath = await uploadToMinio(localPath, `esign/${s.id}.png`);
    return {
      id: s.id,
      idNumber: s.idNumber,
      role: s.role,
      name: s.name,
      eSignFileName: s.eSignFileName,
      eSignPath,
      signatureType: s.signatureType,
      status: s.status,
    };
  }));
  if (data.length > 0) {
    await prisma.signature.createMany({
      data,
      skipDuplicates: true,
    });
  }
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
    console.log('--- Cleaning database ---');
    // Delete in reverse dependency order
    await prisma.certificate.deleteMany();
    await prisma.participantsCOT.deleteMany();
    await prisma.capabilityCOT.deleteMany();
    await prisma.user.deleteMany();
    await prisma.signature.deleteMany();
    await prisma.participant.deleteMany();
    await prisma.cOT.deleteMany();
    await prisma.curriculumSyllabus.deleteMany();
    await prisma.capability.deleteMany();
    await prisma.role.deleteMany();
    console.log('--- Database cleaned ---');

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
