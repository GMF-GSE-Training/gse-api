import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as os from 'os';

const prisma = new PrismaClient();

async function main() {
  await seedDatabase(prisma);
}

async function seedDatabase(prismaService: PrismaClient) {
  const superAdminHashedPassword = await bcrypt.hash('Admin12345', 10);
  const supervisorHashedPassword = await bcrypt.hash('Supervisor12345', 10);
  const lcuHashedPassword = await bcrypt.hash('Lcu12345', 10);
  const userHashedPassword = await bcrypt.hash('User12345', 10);

  const existingRoles = await prismaService.role.findMany({
    where: {
      name: { in: ['super admin', 'supervisor', 'lcu', 'user'] },
    },
  });

  if (existingRoles.length === 0) {
    await prismaService.role.createMany({
      data: [
        { name: 'super admin' },
        { name: 'supervisor' },
        { name: 'lcu' },
        { name: 'user' },
      ],
    });
  }

  const roles = await prismaService.role.findMany();
  const superAdminRole = roles.find((r) => r.name === 'super admin');
  const supervisorRole = roles.find((r) => r.name === 'supervisor');
  const lcuRole = roles.find((r) => r.name === 'lcu');
  const userRole = roles.find((r) => r.name === 'user');

  if (!superAdminRole || !supervisorRole || !lcuRole || !userRole) {
    console.log('One or more roles do not exist');
    return;
  }

  const dinasList = [
    'TA',
    'TB',
    'TC',
    'TF',
    'TJ',
    'TL',
    'TM',
    'TR',
    'TU',
    'TV',
    'TZ',
  ];

  const simA = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'assets', 'images', 'SIM_A.jpg'),
  );
  const simB = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'assets', 'images', 'SIM_B.jpg'),
  );
  const ktp = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'assets', 'images', 'ktp.jpg'),
  );
  const foto = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'assets', 'images', 'foto.jpg'),
  );
  const suratSehatButaWarna = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'public',
      'assets',
      'images',
      'surat_ket_sehat.jpg',
    ),
  );
  const suratBebasNarkoba = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'public',
      'assets',
      'images',
      'surat_bebas_narkoba.jpg',
    ),
  );

  // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost'; // Default fallback

  // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    if (addresses) {
      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
          break;
        }
      }
    }
  }

  const qrCodeBase64 = await QRCode.toDataURL(
    `http://${localIp}:4200/participant/detail`,
  );
  const qrCode = Buffer.from(
    qrCodeBase64.replace(/^data:image\/png;base64,/, ''),
    'base64',
  );

  const participant: any[] = [];
  const dataDummy = [
    { name: 'Andi Pratama', birthPlace: 'Jakarta', birthDate: '1995-01-15' },
    { name: 'Siti Aisyah', birthPlace: 'Bandung', birthDate: '1996-05-10' },
    { name: 'Budi Santoso', birthPlace: 'Surabaya', birthDate: '1997-07-22' },
    { name: 'Cahyo Wibowo', birthPlace: 'Medan', birthDate: '1994-03-12' },
    { name: 'Dewi Lestari', birthPlace: 'Yogyakarta', birthDate: '2000-11-30' },
    { name: 'Eka Saputra', birthPlace: 'Semarang', birthDate: '1993-09-03' },
    { name: 'Fajar Hidayat', birthPlace: 'Bogor', birthDate: '1998-04-21' },
    { name: 'Gilang Rahardian', birthPlace: 'Malang', birthDate: '1999-06-14' },
    { name: 'Hendra Wijaya', birthPlace: 'Denpasar', birthDate: '1994-12-27' },
    {
      name: 'Indah Permatasari',
      birthPlace: 'Makassar',
      birthDate: '2001-08-18',
    },
    { name: 'Joko Priyono', birthPlace: 'Palembang', birthDate: '1995-02-05' },
    {
      name: 'Kurniawan Putra',
      birthPlace: 'Balikpapan',
      birthDate: '1992-07-19',
    },
    {
      name: 'Lina Marlina',
      birthPlace: 'Bandar Lampung',
      birthDate: '1996-09-08',
    },
    {
      name: 'Mahendra Setiawan',
      birthPlace: 'Padang',
      birthDate: '1994-03-15',
    },
    { name: 'Nina Suryani', birthPlace: 'Pekanbaru', birthDate: '1999-11-04' },
    { name: 'Oka Pratama', birthPlace: 'Mataram', birthDate: '1998-12-30' },
    { name: 'Putu Widya', birthPlace: 'Singaraja', birthDate: '2002-06-16' },
    {
      name: 'Qadri Firmansyah',
      birthPlace: 'Banda Aceh',
      birthDate: '1993-10-23',
    },
    { name: 'Rizky Pratomo', birthPlace: 'Pontianak', birthDate: '1997-05-25' },
    { name: 'Samsul Anwar', birthPlace: 'Tangerang', birthDate: '1998-04-19' },
    { name: 'Taufik Hidayat', birthPlace: 'Cirebon', birthDate: '1995-02-17' },
    { name: 'Ujang Suryadi', birthPlace: 'Karawang', birthDate: '1997-09-12' },
    {
      name: 'Vicky Ramadhan',
      birthPlace: 'Tasikmalaya',
      birthDate: '1996-08-03',
    },
    { name: 'Wahyu Adi', birthPlace: 'Depok', birthDate: '1994-12-06' },
    {
      name: 'Yusuf Maulana',
      birthPlace: 'Banjarmasin',
      birthDate: '2001-11-22',
    },
    { name: 'Zainul Fikri', birthPlace: 'Kendari', birthDate: '2000-10-15' },
    { name: 'Ahmad Fauzi', birthPlace: 'Batam', birthDate: '1995-03-07' },
    {
      name: 'Bambang Wijaya',
      birthPlace: 'Palangkaraya',
      birthDate: '1993-07-24',
    },
    { name: 'Citra Maharani', birthPlace: 'Jambi', birthDate: '1998-02-01' },
    { name: 'Doni Prasetyo', birthPlace: 'Ambon', birthDate: '1999-10-09' },
    { name: 'Edwin Saputra', birthPlace: 'Kupang', birthDate: '1996-03-19' },
    { name: 'Fahmi Maulana', birthPlace: 'Palu', birthDate: '1994-08-29' },
    {
      name: 'Gita Apriliani',
      birthPlace: 'Pontianak',
      birthDate: '2002-05-17',
    },
    { name: 'Harry Santoso', birthPlace: 'Sorong', birthDate: '1997-06-12' },
    { name: 'Ika Wardani', birthPlace: 'Ternate', birthDate: '1995-09-26' },
    { name: 'Jefri Rahman', birthPlace: 'Gorontalo', birthDate: '1992-12-03' },
    { name: 'Kiki Amalia', birthPlace: 'Bengkulu', birthDate: '1998-01-25' },
    { name: 'Lina Susanti', birthPlace: 'Padang', birthDate: '2000-02-13' },
    { name: 'Miko Pratama', birthPlace: 'Serang', birthDate: '1994-07-14' },
    { name: 'Nanda Fitri', birthPlace: 'Manado', birthDate: '1999-04-04' },
    { name: 'Oki Saputra', birthPlace: 'Kendari', birthDate: '1995-06-10' },
    { name: 'Putri Ayu', birthPlace: 'Banda Aceh', birthDate: '2003-08-08' },
    { name: 'Qory Maharani', birthPlace: 'Bogor', birthDate: '1991-10-02' },
    { name: 'Reza Pahlevi', birthPlace: 'Malang', birthDate: '1997-11-30' },
    { name: 'Sari Utami', birthPlace: 'Mataram', birthDate: '1998-09-15' },
    { name: 'Tommy Santoso', birthPlace: 'Bandung', birthDate: '2000-06-27' },
    { name: 'Usman Hidayat', birthPlace: 'Semarang', birthDate: '1993-05-22' },
    { name: 'Vera Ayu', birthPlace: 'Yogyakarta', birthDate: '1996-01-19' },
    { name: 'Wawan Setiawan', birthPlace: 'Denpasar', birthDate: '1994-10-18' },
    { name: 'Xena Cahaya', birthPlace: 'Jakarta', birthDate: '1997-02-21' },
    { name: 'Yana Kusuma', birthPlace: 'Makassar', birthDate: '1999-05-25' },
    {
      name: 'Zara Maharani',
      birthPlace: 'Banjarmasin',
      birthDate: '1992-04-16',
    },
    { name: 'Asep Ridwan', birthPlace: 'Cirebon', birthDate: '1993-03-29' },
    { name: 'Bobby Saputra', birthPlace: 'Palembang', birthDate: '1995-07-04' },
    { name: 'Cahaya Putri', birthPlace: 'Manokwari', birthDate: '2001-03-23' },
    { name: 'Dara Kartika', birthPlace: 'Banda Aceh', birthDate: '1994-08-11' },
    { name: 'Erlangga Pratama', birthPlace: 'Medan', birthDate: '2002-09-21' },
    { name: 'Fani Fitriani', birthPlace: 'Batam', birthDate: '1998-12-12' },
    { name: 'Gandi Wibisono', birthPlace: 'Surabaya', birthDate: '1996-10-10' },
    {
      name: 'Hana Rahmawati',
      birthPlace: 'Balikpapan',
      birthDate: '1997-01-01',
    },
    { name: 'Irfan Suryadi', birthPlace: 'Depok', birthDate: '1995-04-29' },
    { name: 'Januar Setiadi', birthPlace: 'Malang', birthDate: '2000-03-18' },
    { name: 'Kirana Adi', birthPlace: 'Semarang', birthDate: '1999-06-01' },
    {
      name: 'Linda Sari',
      birthPlace: 'Bandar Lampung',
      birthDate: '1998-07-13',
    },
    { name: 'Maya Lestari', birthPlace: 'Bengkulu', birthDate: '1994-05-31' },
    { name: 'Nia Widya', birthPlace: 'Jambi', birthDate: '2001-09-29' },
    { name: 'Oma Suryani', birthPlace: 'Palu', birthDate: '1997-02-14' },
    {
      name: 'Panca Ramadhan',
      birthPlace: 'Samarinda',
      birthDate: '1995-08-08',
    },
    { name: 'Qiana Pratiwi', birthPlace: 'Ambon', birthDate: '1998-10-21' },
    { name: 'Ratna Puspita', birthPlace: 'Kupang', birthDate: '2003-03-16' },
    { name: 'Sasa Pratami', birthPlace: 'Pekanbaru', birthDate: '1996-06-25' },
    { name: 'Tina Permata', birthPlace: 'Palu', birthDate: '1992-07-10' },
    { name: 'Umar Prakoso', birthPlace: 'Manado', birthDate: '1998-12-22' },
    { name: 'Vina Saputri', birthPlace: 'Medan', birthDate: '1995-01-28' },
    {
      name: 'Windi Pratiwi',
      birthPlace: 'Tanjungpinang',
      birthDate: '2002-11-30',
    },
    {
      name: 'Xavier Raka',
      birthPlace: 'Pematangsiantar',
      birthDate: '1993-04-01',
    },
    { name: 'Yudi Santoso', birthPlace: 'Padang', birthDate: '1999-08-02' },
    { name: 'Zahra Fitri', birthPlace: 'Bukittinggi', birthDate: '2001-07-05' },
  ];

  console.log(dataDummy.length);
  let j = 1;

  // Seed 30 participants
  for (let i = 0; i < 30; i++) {
    const email = `participant${i + 1}@example.com`;
    const existingParticipant = await prismaService.participant.findFirst({
      where: { email },
    });
    const dinas = dinasList[i % 5];
    console.log((i + 1) % 2 === 0 ? `P${j}` : null);

    if (!existingParticipant) {
      participant[i] = await prismaService.participant.create({
        data: {
          idNumber: (i + 1) % 2 === 0 ? `P${j}` : null,
          name: dataDummy[i].name,
          nik: `${i}`,
          dinas: (i + 1) % 2 === 0 ? dinas : null,
          bidang: (i + 1) % 2 === 0 ? `${dinas}-${j}` : null,
          company: (i + 1) % 2 === 0 ? 'GMF' : `Perusahaan ${j}`,
          email: email,
          phoneNumber: `0812345678${i.toString().padStart(2, '0')}`,
          nationality: 'Indonesia',
          placeOfBirth: dataDummy[i].birthPlace,
          dateOfBirth: new Date(dataDummy[i].birthDate),
          simA,
          simAFileName: 'SIM_A.png',
          simB,
          simBFileName: 'SIM_B.jpg',
          ktp,
          ktpFileName: 'ktp.png',
          foto,
          fotoFileName: 'foto.png',
          suratSehatButaWarna,
          suratSehatButaWarnaFileName: 'surat_ket_sehat.png',
          tglKeluarSuratSehatButaWarna: new Date(2025, 11, 31),
          suratBebasNarkoba,
          suratBebasNarkobaFileName: 'surat_bebas_narkoba.png',
          tglKeluarSuratBebasNarkoba: new Date(2025, 11, 31),
          gmfNonGmf: (i + 1) % 2 === 0 ? 'GMF' : 'Non GMF',
          qrCode,
        },
      });

      if ((i + 1) % 2 === 0) {
        j++;
      }

      console.log(`Participant ${i + 1} created successfully.`);
    }
  }

  // Seed 5 super admins
  for (let i = 0; i < 5; i++) {
    const email = `superadmin${i + 1}@example.com`;
    const existingUser = await prismaService.user.findFirst({
      where: { email },
    });

    if (!existingUser) {
      await prismaService.user.create({
        data: {
          idNumber: `SA${i.toString().padStart(3, '0')}`,
          email,
          name: dataDummy[i + 15].name,
          password: superAdminHashedPassword,
          roleId: superAdminRole.id,
          verifiedAccount: true,
        },
      });
      console.log(`Super Admin ${i + 1} created successfully.`);
    }
  }

  // Seed 5 supervisors
  for (let i = 0; i < 5; i++) {
    const email = `supervisor${i + 1}@example.com`;
    const existingUser = await prismaService.user.findFirst({
      where: { email },
    });
    const dinas = dinasList[i % 5];

    if (!existingUser) {
      await prismaService.user.create({
        data: {
          idNumber: `SP${i.toString().padStart(3, '0')}`,
          email,
          name: dataDummy[i + 20].name,
          password: supervisorHashedPassword,
          roleId: supervisorRole.id,
          verifiedAccount: true,
          dinas: dinas,
        },
      });
      console.log(`Supervisor ${i + 1} created successfully.`);
    }
  }

  // Seed 5 LCUs
  for (let i = 0; i < 11; i++) {
    const email = `lcu${i + 1}@example.com`;
    const existingUser = await prismaService.user.findFirst({
      where: { email },
    });

    if (!existingUser) {
      await prismaService.user.create({
        data: {
          idNumber: `LCU${i.toString().padStart(3, '0')}`,
          email,
          name: dataDummy[i + 25].name,
          dinas: dinasList[i],
          password: lcuHashedPassword,
          roleId: lcuRole.id,
          verifiedAccount: true,
        },
      });
      console.log(`LCU ${i + 1} created successfully.`);
    }
  }

  // Seed 30 Users
  for (let i = 0; i < 30; i++) {
    const email = `participant${i + 1}@example.com`;
    const existingUser = await prismaService.user.findFirst({
      where: { email },
    });

    if (!existingUser) {
      await prismaService.user.create({
        data: {
          idNumber: participant[i].idNumber,
          participantId: participant[i].id,
          nik: participant[i].nik,
          email: participant[i].email,
          name: participant[i].name,
          password: userHashedPassword,
          dinas: participant[i].dinas,
          roleId: userRole.id,
          verifiedAccount: true,
        },
      });

      console.log(`User ${i + 1} created successfully.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
