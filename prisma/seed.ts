// import * as dotenv from 'dotenv';
// import * as path from 'path';
// import * as fs from 'fs';
// import { PrismaClient, SignatureType } from '@prisma/client';
// import * as bcrypt from 'bcrypt';
// import * as QRCode from 'qrcode';
// import * as os from 'os';

// // Tentukan environment (default ke 'development' jika NODE_ENV tidak ada)
// const env = process.env.NODE_ENV || 'development';

// // Path ke .env berdasarkan NODE_ENV
// const envPath = path.resolve(__dirname, '..', `.env.${env}`);
// const defaultEnvPath = path.resolve(__dirname, '..', '.env');

// // Muat .env berdasarkan NODE_ENV, fallback ke .env default jika tidak ada
// if (fs.existsSync(envPath)) {
//   dotenv.config({ path: envPath });
//   console.log('Loading .env from:', envPath);
// } else {
//   console.log(`.env.${env} not found at ${envPath}, falling back to default .env`);
//   if (fs.existsSync(defaultEnvPath)) {
//     dotenv.config({ path: defaultEnvPath });
//     console.log('Loading .env from:', defaultEnvPath);
//   } else {
//     throw new Error('No .env file found. Please provide either .env.${env} or .env in the root directory.');
//   }
// }

// // Debug: Pastikan DATABASE_URL terdeteksi
// console.log('Environment:', env);
// console.log('DATABASE_URL:', process.env.DATABASE_URL);

// if (!process.env.DATABASE_URL) {
//   throw new Error('DATABASE_URL not found in environment variables. Please check your .env file.');
// }

// // Inisialisasi PrismaClient setelah memuat .env
// const prisma = new PrismaClient();

// async function seedDatabase(prismaService: PrismaClient) {
//   const superAdminHashedPassword = await bcrypt.hash('Admin12345', 10);
//   const supervisorHashedPassword = await bcrypt.hash('Supervisor12345', 10);
//   const lcuHashedPassword = await bcrypt.hash('Lcu12345', 10);
//   const userHashedPassword = await bcrypt.hash('User12345', 10);

//   // Seed Roles
//   const existingRoles = await prismaService.role.findMany({
//     where: {
//       name: { in: ['super admin', 'supervisor', 'lcu', 'user'] },
//     },
//   });

//   if (existingRoles.length === 0) {
//     await prismaService.role.createMany({
//       data: [
//         { name: 'super admin' },
//         { name: 'supervisor' },
//         { name: 'lcu' },
//         { name: 'user' },
//       ],
//     });
//     console.log('Roles seeded successfully.');
//   }

//   const roles = await prismaService.role.findMany();
//   const superAdminRole = roles.find((r) => r.name === 'super admin');
//   const supervisorRole = roles.find((r) => r.name === 'supervisor');
//   const lcuRole = roles.find((r) => r.name === 'lcu');
//   const userRole = roles.find((r) => r.name === 'user');

//   if (!superAdminRole || !supervisorRole || !lcuRole || !userRole) {
//     console.log('One or more roles do not exist');
//     return;
//   }

//   // Dinas List
//   const dinasList = ['TA', 'TB', 'TC', 'TF', 'TJ', 'TL', 'TM', 'TR', 'TU', 'TV', 'TZ'];

//   // Load Files
//   const simA = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'images', 'SIM_A.jpg'));
//   const simB = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'images', 'SIM_B.jpg'));
//   const ktp = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'images', 'ktp.jpg'));
//   const foto = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'images', 'foto.jpg'));
//   const suratSehatButaWarna = fs.readFileSync(
//     path.join(__dirname, '..', 'public', 'assets', 'images', 'surat_ket_sehat.jpg'),
//   );
//   const suratBebasNarkoba = fs.readFileSync(
//     path.join(__dirname, '..', 'public', 'assets', 'images', 'surat_bebas_narkoba.jpg'),
//   );
//   const eSign1 = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'images', 'e-sign1.png'));
//   const eSign2 = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'images', 'e-sign2.png'));

//   // Generate QR Code
//   const networkInterfaces = os.networkInterfaces();
//   let localIp = 'localhost';
//   for (const interfaceName in networkInterfaces) {
//     const addresses = networkInterfaces[interfaceName];
//     if (addresses) {
//       for (const addr of addresses) {
//         if (addr.family === 'IPv4' && !addr.internal) {
//           localIp = addr.address;
//           break;
//         }
//       }
//     }
//   }
//   const qrCodeBase64 = await QRCode.toDataURL(`http://${localIp}:4200/participant/detail`);
//   const qrCode = Buffer.from(qrCodeBase64.replace(/^data:image\/png;base64,/, ''), 'base64');

//   // Seed Participants
//   const participant: any[] = [];
//   const dataDummy = [
//     { name: 'Andi Pratama', birthPlace: 'Jakarta', birthDate: '1995-01-15' },
//     { name: 'Siti Aisyah', birthPlace: 'Bandung', birthDate: '1996-05-10' },
//     { name: 'Budi Santoso', birthPlace: 'Surabaya', birthDate: '1997-07-22' },
//     { name: 'Cahyo Wibowo', birthPlace: 'Medan', birthDate: '1994-03-12' },
//     { name: 'Dewi Lestari', birthPlace: 'Yogyakarta', birthDate: '2000-11-30' },
//     { name: 'Eka Saputra', birthPlace: 'Semarang', birthDate: '1993-09-03' },
//     { name: 'Fajar Hidayat', birthPlace: 'Bogor', birthDate: '1998-04-21' },
//     { name: 'Gilang Rahardian', birthPlace: 'Malang', birthDate: '1999-06-14' },
//     { name: 'Hendra Wijaya', birthPlace: 'Denpasar', birthDate: '1994-12-27' },
//     { name: 'Indah Permatasari', birthPlace: 'Makassar', birthDate: '2001-08-18' },
//     { name: 'Joko Priyono', birthPlace: 'Palembang', birthDate: '1995-02-05' },
//     { name: 'Kurniawan Putra', birthPlace: 'Balikpapan', birthDate: '1992-07-19' },
//     { name: 'Lina Marlina', birthPlace: 'Bandar Lampung', birthDate: '1996-09-08' },
//     { name: 'Mahendra Setiawan', birthPlace: 'Padang', birthDate: '1994-03-15' },
//     { name: 'Nina Suryani', birthPlace: 'Pekanbaru', birthDate: '1999-11-04' },
//     { name: 'Oka Pratama', birthPlace: 'Mataram', birthDate: '1998-12-30' },
//     { name: 'Putu Widya', birthPlace: 'Singaraja', birthDate: '2002-06-16' },
//     { name: 'Qadri Firmansyah', birthPlace: 'Banda Aceh', birthDate: '1993-10-23' },
//     { name: 'Rizky Pratomo', birthPlace: 'Pontianak', birthDate: '1997-05-25' },
//     { name: 'Samsul Anwar', birthPlace: 'Tangerang', birthDate: '1998-04-19' },
//     { name: 'Taufik Hidayat', birthPlace: 'Cirebon', birthDate: '1995-02-17' },
//     { name: 'Ujang Suryadi', birthPlace: 'Karawang', birthDate: '1997-09-12' },
//     { name: 'Vicky Ramadhan', birthPlace: 'Tasikmalaya', birthDate: '1996-08-03' },
//     { name: 'Wahyu Adi', birthPlace: 'Depok', birthDate: '1994-12-06' },
//     { name: 'Yusuf Maulana', birthPlace: 'Banjarmasin', birthDate: '2001-11-22' },
//     { name: 'Zainul Fikri', birthPlace: 'Kendari', birthDate: '2000-10-15' },
//     { name: 'Ahmad Fauzi', birthPlace: 'Batam', birthDate: '1995-03-07' },
//     { name: 'Bambang Wijaya', birthPlace: 'Palangkaraya', birthDate: '1993-07-24' },
//     { name: 'Citra Maharani', birthPlace: 'Jambi', birthDate: '1998-02-01' },
//     { name: 'Doni Prasetyo', birthPlace: 'Ambon', birthDate: '1999-10-09' },
//     { name: 'Edwin Saputra', birthPlace: 'Kupang', birthDate: '1996-03-19' },
//     { name: 'Fahmi Maulana', birthPlace: 'Palu', birthDate: '1994-08-29' },
//     { name: 'Gita Apriliani', birthPlace: 'Pontianak', birthDate: '2002-05-17' },
//     { name: 'Harry Santoso', birthPlace: 'Sorong', birthDate: '1997-06-12' },
//     { name: 'Ika Wardani', birthPlace: 'Ternate', birthDate: '1995-09-26' },
//   ];

//   let j = 1;
//   for (let i = 0; i < 30; i++) {
//     const email = `participant${i + 1}@example.com`;
//     const existingParticipant = await prismaService.participant.findFirst({
//       where: { email },
//     });
//     const dinas = dinasList[i % 5];

//     if (!existingParticipant) {
//       participant[i] = await prismaService.participant.create({
//         data: {
//           idNumber: (i + 1) % 2 === 0 ? `P${j}` : null,
//           name: dataDummy[i].name,
//           nik: `${i}`,
//           dinas: (i + 1) % 2 === 0 ? dinas : null,
//           bidang: (i + 1) % 2 === 0 ? `${dinas}-${j}` : null,
//           company: (i + 1) % 2 === 0 ? 'GMF' : `Perusahaan ${j}`,
//           email: email,
//           phoneNumber: `0812345678${i.toString().padStart(2, '0')}`,
//           nationality: 'Indonesia',
//           placeOfBirth: dataDummy[i].birthPlace,
//           dateOfBirth: new Date(dataDummy[i].birthDate),
//           simA,
//           simAFileName: 'SIM_A.jpg',
//           simB,
//           simBFileName: 'SIM_B.jpg',
//           ktp,
//           ktpFileName: 'ktp.jpg',
//           foto,
//           fotoFileName: 'foto.jpg',
//           suratSehatButaWarna,
//           suratSehatButaWarnaFileName: 'surat_ket_sehat.jpg',
//           tglKeluarSuratSehatButaWarna: new Date(2025, 11, 31),
//           suratBebasNarkoba,
//           suratBebasNarkobaFileName: 'surat_bebas_narkoba.jpg',
//           tglKeluarSuratBebasNarkoba: new Date(2025, 11, 31),
//           gmfNonGmf: (i + 1) % 2 === 0 ? 'GMF' : 'Non GMF',
//           qrCode,
//         },
//       });
//       if ((i + 1) % 2 === 0) j++;
//       console.log(`Participant ${i + 1} created successfully.`);
//     }
//   }

//   // Seed Users (Super Admins)
//   for (let i = 0; i < 5; i++) {
//     const email = `superadmin${i + 1}@example.com`;
//     const existingUser = await prismaService.user.findFirst({ where: { email } });

//     if (!existingUser) {
//       await prismaService.user.create({
//         data: {
//           idNumber: `SA${i.toString().padStart(3, '0')}`,
//           email,
//           name: dataDummy[i + 15].name,
//           password: superAdminHashedPassword,
//           roleId: superAdminRole.id,
//           verifiedAccount: true,
//         },
//       });
//       console.log(`Super Admin ${i + 1} created successfully.`);
//     }
//   }

//   // Seed Supervisors
//   for (let i = 0; i < 5; i++) {
//     const email = `supervisor${i + 1}@example.com`;
//     const existingUser = await prismaService.user.findFirst({ where: { email } });
//     const dinas = dinasList[i % 5];

//     if (!existingUser) {
//       await prismaService.user.create({
//         data: {
//           idNumber: `SP${i.toString().padStart(3, '0')}`,
//           email,
//           name: dataDummy[i + 20].name,
//           password: supervisorHashedPassword,
//           roleId: supervisorRole.id,
//           verifiedAccount: true,
//           dinas,
//         },
//       });
//       console.log(`Supervisor ${i + 1} created successfully.`);
//     }
//   }

//   // Seed LCUs (Batasi ke 5 karena dataDummy hanya cukup sampai sini)
//   for (let i = 0; i < 5; i++) {
//     const email = `lcu${i + 1}@example.com`;
//     const existingUser = await prismaService.user.findFirst({ where: { email } });

//     if (!existingUser) {
//       await prismaService.user.create({
//         data: {
//           idNumber: `LCU${i.toString().padStart(3, '0')}`,
//           email,
//           name: dataDummy[i + 25].name,
//           dinas: dinasList[i],
//           password: lcuHashedPassword,
//           roleId: lcuRole.id,
//           verifiedAccount: true,
//         },
//       });
//       console.log(`LCU ${i + 1} created successfully.`);
//     }
//   }

//   // Seed Participant Users
//   for (let i = 0; i < 30; i++) {
//     const email = `participant${i + 1}@example.com`;
//     const existingUser = await prismaService.user.findFirst({ where: { email } });

//     if (!existingUser) {
//       await prismaService.user.create({
//         data: {
//           idNumber: participant[i].idNumber,
//           participantId: participant[i].id,
//           nik: participant[i].nik,
//           email: participant[i].email,
//           name: participant[i].name,
//           password: userHashedPassword,
//           dinas: participant[i].dinas,
//           roleId: userRole.id,
//           verifiedAccount: true,
//         },
//       });
//       console.log(`User ${i + 1} created successfully.`);
//     }
//   }

//   // Seed Capabilities
//   const existingCapabilities = await prismaService.capability.findMany();
//   if (existingCapabilities.length === 0) {
//     await prismaService.capability.createMany({
//       data: [
//         {
//           ratingCode: 'RC001',
//           trainingCode: 'TC001',
//           trainingName: 'Basic Mechanical Training',
//           totalTheoryDurationRegGse: 20,
//           totalPracticeDurationRegGse: 40,
//           totalTheoryDurationCompetency: 15,
//           totalPracticeDurationCompetency: 30,
//           totalDuration: 105,
//         },
//         {
//           ratingCode: 'RC002',
//           trainingCode: 'TC002',
//           trainingName: 'Advanced Electrical Training',
//           totalTheoryDurationRegGse: 25,
//           totalPracticeDurationRegGse: 35,
//           totalTheoryDurationCompetency: 20,
//           totalPracticeDurationCompetency: 25,
//           totalDuration: 105,
//         },
//         {
//           ratingCode: 'RC003',
//           trainingCode: 'TC003',
//           trainingName: 'Safety Procedures Training',
//           totalTheoryDurationRegGse: 15,
//           totalPracticeDurationRegGse: 20,
//           totalTheoryDurationCompetency: 10,
//           totalPracticeDurationCompetency: 15,
//           totalDuration: 60,
//         },
//       ],
//     });
//     console.log('Capabilities seeded successfully.');
//   }

//   // Seed COTs
//   const existingCots = await prismaService.cOT.findMany();
//   if (existingCots.length === 0) {
//     await prismaService.cOT.createMany({
//       data: [
//         {
//           startDate: new Date('2025-04-01'),
//           endDate: new Date('2025-04-10'),
//           trainingLocation: 'Jakarta Training Center',
//           theoryInstructorRegGse: 'Budi Santoso',
//           theoryInstructorCompetency: 'Dewi Lestari',
//           practicalInstructor1: 'Andi Pratama',
//           practicalInstructor2: 'Siti Aisyah',
//           status: 'Scheduled',
//         },
//         {
//           startDate: new Date('2025-05-01'),
//           endDate: new Date('2025-05-15'),
//           trainingLocation: 'Bandung Training Center',
//           theoryInstructorRegGse: 'Cahyo Wibowo',
//           theoryInstructorCompetency: 'Eka Saputra',
//           practicalInstructor1: 'Fajar Hidayat',
//           practicalInstructor2: 'Gilang Rahardian',
//           status: 'In Progress',
//         },
//         {
//           startDate: new Date('2025-06-01'),
//           endDate: new Date('2025-06-07'),
//           trainingLocation: 'Surabaya Training Center',
//           theoryInstructorRegGse: 'Hendra Wijaya',
//           theoryInstructorCompetency: 'Indah Permatasari',
//           practicalInstructor1: 'Joko Priyono',
//           practicalInstructor2: 'Kurniawan Putra',
//           status: 'Completed',
//         },
//       ],
//     });
//     console.log('COTs seeded successfully.');
//   }

//   // Seed CapabilityCOT
//   const capabilities = await prismaService.capability.findMany();
//   const cots = await prismaService.cOT.findMany();
//   const existingCapabilityCots = await prismaService.capabilityCOT.findMany();
//   if (existingCapabilityCots.length === 0 && capabilities.length > 0 && cots.length > 0) {
//     await prismaService.capabilityCOT.createMany({
//       data: [
//         { capabilityId: capabilities[0].id, cotId: cots[0].id },
//         { capabilityId: capabilities[1].id, cotId: cots[1].id },
//         { capabilityId: capabilities[2].id, cotId: cots[2].id },
//         { capabilityId: capabilities[0].id, cotId: cots[1].id },
//       ],
//     });
//     console.log('CapabilityCOTs seeded successfully.');
//   }

//   // Seed ParticipantsCOT
//   const existingParticipantsCots = await prismaService.participantsCOT.findMany();
//   if (existingParticipantsCots.length === 0 && participant.length > 0 && cots.length > 0) {
//     await prismaService.participantsCOT.createMany({
//       data: [
//         { participantId: participant[0].id, cotId: cots[0].id },
//         { participantId: participant[1].id, cotId: cots[0].id },
//         { participantId: participant[2].id, cotId: cots[1].id },
//         { participantId: participant[3].id, cotId: cots[1].id },
//         { participantId: participant[4].id, cotId: cots[2].id },
//       ],
//     });
//     console.log('ParticipantsCOTs seeded successfully.');
//   }

//   // Seed Signatures
//   const existingSignatures = await prismaService.signature.findMany();
//   if (existingSignatures.length === 0) {
//     await prismaService.signature.createMany({
//       data: [
//         {
//           idNumber: 'SIG001',
//           role: 'Instructor',
//           name: 'Andi Pratama',
//           eSign: eSign1,
//           eSignFileName: 'e-sign1.png',
//           signatureType: SignatureType.SIGNATURE1,
//           status: true,
//         },
//         {
//           idNumber: 'SIG002',
//           role: 'Supervisor',
//           name: 'Siti Aisyah',
//           eSign: eSign2,
//           eSignFileName: 'e-sign2.png',
//           signatureType: SignatureType.SIGNATURE2,
//           status: true,
//         },
//       ],
//     });
//     console.log('Signatures seeded successfully.');
//   }
// }

// async function main() {
//   await seedDatabase(prisma);
// }

// main()
//   .catch((e) => {
//     console.error('Seeding failed:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { NestFactory } from '@nestjs/core';

import { PrismaClient, SignatureType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as QRCode from 'qrcode';

import { AppModule } from '../src/app.module.js';
import { FileUploadService } from '../src/file-upload/file-upload.service.js';

// Tentukan environment
const env = process.env.NODE_ENV || 'development';

// Path ke .env
const envPath = path.resolve(__dirname, '..', `.env.${env}`);
const defaultEnvPath = path.resolve(__dirname, '..', '.env');

// Muat .env
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('Loading .env from:', envPath);
} else {
  console.log(
    `.env.${env} not found at ${envPath}, falling back to default .env`
  );
  if (fs.existsSync(defaultEnvPath)) {
    dotenv.config({ path: defaultEnvPath });
    console.log('Loading .env from:', defaultEnvPath);
  } else {
    throw new Error(
      'No .env file found. Please provide either .env.${env} or .env in the root directory.'
    );
  }
}

// Debug environment
console.log('Environment:', env);
console.log('DATABASE_URL:', process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL not found in environment variables. Please check your .env file.'
  );
}

// Inisialisasi PrismaClient
const prisma = new PrismaClient();

/**
 *
 * @param prismaService
 * @param fileUploadService
 */
async function seedDatabase(
  prismaService: PrismaClient,
  fileUploadService: FileUploadService
) {
  const superAdminHashedPassword = await bcrypt.hash('Admin12345', 10);
  const supervisorHashedPassword = await bcrypt.hash('Supervisor12345', 10);
  const lcuHashedPassword = await bcrypt.hash('Lcu12345', 10);
  const userHashedPassword = await bcrypt.hash('User12345', 10);

  // Seed Roles
  const existingRoles = await prismaService.role.findMany({
    where: { name: { in: ['super admin', 'supervisor', 'lcu', 'user'] } },
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
    console.log('Roles seeded successfully.');
  }

  const roles = await prismaService.role.findMany();
  const superAdminRole = roles.find(r => r.name === 'super admin');
  const supervisorRole = roles.find(r => r.name === 'supervisor');
  const lcuRole = roles.find(r => r.name === 'lcu');
  const userRole = roles.find(r => r.name === 'user');

  if (!superAdminRole || !supervisorRole || !lcuRole || !userRole) {
    console.log('One or more roles do not exist');
    return;
  }

  // Dinas List
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

  // Load Files
  const filesToUpload = [
    {
      path: path.join(
        __dirname,
        '..',
        'public',
        'assets',
        'images',
        'SIM_A.jpg'
      ),
      originalname: 'SIM_A.jpg',
      subfolder: 'documents',
      key: 'simAId',
    },
    {
      path: path.join(
        __dirname,
        '..',
        'public',
        'assets',
        'images',
        'SIM_B.jpg'
      ),
      originalname: 'SIM_B.jpg',
      subfolder: 'documents',
      key: 'simBId',
    },
    {
      path: path.join(__dirname, '..', 'public', 'assets', 'images', 'ktp.jpg'),
      originalname: 'ktp.jpg',
      subfolder: 'documents',
      key: 'ktpId',
    },
    {
      path: path.join(
        __dirname,
        '..',
        'public',
        'assets',
        'images',
        'foto.jpg'
      ),
      originalname: 'foto.jpg',
      subfolder: 'images',
      key: 'fotoId',
    },
    {
      path: path.join(
        __dirname,
        '..',
        'public',
        'assets',
        'images',
        'surat_ket_sehat.jpg'
      ),
      originalname: 'surat_ket_sehat.jpg',
      subfolder: 'documents',
      key: 'suratSehatButaWarnaId',
    },
    {
      path: path.join(
        __dirname,
        '..',
        'public',
        'assets',
        'images',
        'surat_bebas_narkoba.jpg'
      ),
      originalname: 'surat_bebas_narkoba.jpg',
      subfolder: 'documents',
      key: 'suratBebasNarkobaId',
    },
  ].map(file => {
    if (!fs.existsSync(file.path)) {
      throw new Error(`File not found: ${file.path}`);
    }
    return {
      buffer: fs.readFileSync(file.path),
      originalname: file.originalname,
      subfolder: file.subfolder,
      key: file.key,
    };
  });

  const eSignFiles = [
    {
      path: path.join(
        __dirname,
        '..',
        'public',
        'assets',
        'images',
        'e-sign1.png'
      ),
      originalname: 'e-sign1.png',
      subfolder: 'signatures',
    },
    {
      path: path.join(
        __dirname,
        '..',
        'public',
        'assets',
        'images',
        'e-sign2.png'
      ),
      originalname: 'e-sign2.png',
      subfolder: 'signatures',
    },
  ].map(file => {
    if (!fs.existsSync(file.path)) {
      throw new Error(`File not found: ${file.path}`);
    }
    return {
      buffer: fs.readFileSync(file.path),
      originalname: file.originalname,
      subfolder: file.subfolder,
    };
  });

  // Generate QR Code Base URL
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    if (addresses) {
      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          localIp = addr.address;
          break;
        }
      }
    }
  }

  // Seed Participants
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
  ];

  let j = 1;
  for (let i = 0; i < 30; i++) {
    const email = `participant${i + 1}@example.com`;
    const existingParticipant = await prismaService.participant.findFirst({
      where: { email },
    });
    const dinas = dinasList[i % 5];

    if (!existingParticipant) {
      participant[i] = await prismaService.participant.create({
        data: {
          idNumber: (i + 1) % 2 === 0 ? `P${j}` : null,
          name: dataDummy[i].name,
          nik: `${i}`,
          dinas: (i + 1) % 2 === 0 ? dinas : null,
          bidang: (i + 1) % 2 === 0 ? `${dinas}-${j}` : null,
          company: (i + 1) % 2 === 0 ? 'GMF' : `Perusahaan ${j}`,
          email,
          phoneNumber: `0812345678${i.toString().padStart(2, '0')}`,
          nationality: 'Indonesia',
          placeOfBirth: dataDummy[i].birthPlace,
          dateOfBirth: new Date(dataDummy[i].birthDate),
          tglKeluarSuratSehatButaWarna: new Date(2025, 11, 31),
          tglKeluarSuratBebasNarkoba: new Date(2025, 11, 31),
          gmfNonGmf: (i + 1) % 2 === 0 ? 'GMF' : 'Non GMF',
        },
      });

      // Upload files
      for (const file of filesToUpload) {
        const multerFile: Express.Multer.File = {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: getMimeType(file.originalname),
          size: file.buffer.length,
          fieldname: 'file',
          encoding: '7bit',
          destination: '',
          filename: '',
          path: '',
          stream: undefined as any, // TypeScript workaround
        };
        const { fileId } = await fileUploadService.uploadFile(
          multerFile,
          participant[i].idNumber || participant[i].id,
          file.subfolder,
          true // File sensitif
        );
        await prismaService.participant.update({
          where: { id: participant[i].id },
          data: { [file.key]: fileId },
        });
      }

      // Generate dan upload QR Code
      const frontendUrl = process.env.FRONTEND_URL || `http://${localIp}:4200`;
      const qrCodeUrl = `${frontendUrl}/participants/${participant[i].id}/detail`;
      const qrCodeBuffer = await QRCode.toBuffer(qrCodeUrl, { type: 'png' });
      const multerQrCode: Express.Multer.File = {
        buffer: qrCodeBuffer,
        originalname: `qrcode_${participant[i].id}.png`,
        mimetype: 'image/png',
        size: qrCodeBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
        stream: undefined as any, // TypeScript workaround
      };
      const { fileId: qrCodeId } = await fileUploadService.uploadFile(
        multerQrCode,
        participant[i].idNumber || participant[i].id,
        'qrcodes',
        false // QR code tidak sensitif
      );
      await prismaService.participant.update({
        where: { id: participant[i].id },
        data: { qrCodeId, qrCodeLink: qrCodeUrl },
      });

      if ((i + 1) % 2 === 0) j++;
      console.log(
        `Participant ${i + 1} created successfully with files and QR code.`
      );
    }
  }

  // Seed Users (Super Admins)
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

  // Seed Supervisors
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
          dinas,
        },
      });
      console.log(`Supervisor ${i + 1} created successfully.`);
    }
  }

  // Seed LCUs
  for (let i = 0; i < 5; i++) {
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

  // Seed Participant Users
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

  // Seed Capabilities
  const existingCapabilities = await prismaService.capability.findMany();
  if (existingCapabilities.length === 0) {
    await prismaService.capability.createMany({
      data: [
        {
          ratingCode: 'RC001',
          trainingCode: 'TC001',
          trainingName: 'Basic Mechanical Training',
          totalTheoryDurationRegGse: 20,
          totalPracticeDurationRegGse: 40,
          totalTheoryDurationCompetency: 15,
          totalPracticeDurationCompetency: 30,
          totalDuration: 105,
        },
        {
          ratingCode: 'RC002',
          trainingCode: 'TC002',
          trainingName: 'Advanced Electrical Training',
          totalTheoryDurationRegGse: 25,
          totalPracticeDurationRegGse: 35,
          totalTheoryDurationCompetency: 20,
          totalPracticeDurationCompetency: 25,
          totalDuration: 105,
        },
        {
          ratingCode: 'RC003',
          trainingCode: 'TC003',
          trainingName: 'Safety Procedures Training',
          totalTheoryDurationRegGse: 15,
          totalPracticeDurationRegGse: 20,
          totalTheoryDurationCompetency: 10,
          totalPracticeDurationCompetency: 15,
          totalDuration: 60,
        },
      ],
    });
    console.log('Capabilities seeded successfully.');
  }

  // Seed COTs
  const existingCots = await prismaService.cOT.findMany();
  if (existingCots.length === 0) {
    await prismaService.cOT.createMany({
      data: [
        {
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-04-10'),
          trainingLocation: 'Jakarta Training Center',
          theoryInstructorRegGse: 'Budi Santoso',
          theoryInstructorCompetency: 'Dewi Lestari',
          practicalInstructor1: 'Andi Pratama',
          practicalInstructor2: 'Siti Aisyah',
          status: 'Scheduled',
        },
        {
          startDate: new Date('2025-05-01'),
          endDate: new Date('2025-05-15'),
          trainingLocation: 'Bandung Training Center',
          theoryInstructorRegGse: 'Cahyo Wibowo',
          theoryInstructorCompetency: 'Eka Saputra',
          practicalInstructor1: 'Fajar Hidayat',
          practicalInstructor2: 'Gilang Rahardian',
          status: 'In Progress',
        },
        {
          startDate: new Date('2025-06-01'),
          endDate: new Date('2025-06-07'),
          trainingLocation: 'Surabaya Training Center',
          theoryInstructorRegGse: 'Hendra Wijaya',
          theoryInstructorCompetency: 'Indah Permatasari',
          practicalInstructor1: 'Joko Priyono',
          practicalInstructor2: 'Kurniawan Putra',
          status: 'Completed',
        },
      ],
    });
    console.log('COTs seeded successfully.');
  }

  // Seed CapabilityCOT
  const capabilities = await prismaService.capability.findMany();
  const cots = await prismaService.cOT.findMany();
  const existingCapabilityCots = await prismaService.capabilityCOT.findMany();
  if (
    existingCapabilityCots.length === 0 &&
    capabilities.length > 0 &&
    cots.length > 0
  ) {
    await prismaService.capabilityCOT.createMany({
      data: [
        { capabilityId: capabilities[0].id, cotId: cots[0].id },
        { capabilityId: capabilities[1].id, cotId: cots[1].id },
        { capabilityId: capabilities[2].id, cotId: cots[2].id },
        { capabilityId: capabilities[0].id, cotId: cots[1].id },
      ],
    });
    console.log('CapabilityCOTs seeded successfully.');
  }

  // Seed ParticipantsCOT
  const existingParticipantsCots =
    await prismaService.participantsCOT.findMany();
  if (
    existingParticipantsCots.length === 0 &&
    participant.length > 0 &&
    cots.length > 0
  ) {
    await prismaService.participantsCOT.createMany({
      data: [
        { participantId: participant[0].id, cotId: cots[0].id },
        { participantId: participant[1].id, cotId: cots[0].id },
        { participantId: participant[2].id, cotId: cots[1].id },
        { participantId: participant[3].id, cotId: cots[1].id },
        { participantId: participant[4].id, cotId: cots[2].id },
      ],
    });
    console.log('ParticipantsCOTs seeded successfully.');
  }

  // Seed Signatures
  const existingSignatures = await prismaService.signature.findMany();
  if (existingSignatures.length === 0) {
    const signatures = [
      {
        idNumber: 'SIG001',
        role: 'Instructor',
        name: 'Andi Pratama',
        file: eSignFiles[0],
        signatureType: SignatureType.SIGNATURE1,
      },
      {
        idNumber: 'SIG002',
        role: 'Supervisor',
        name: 'Siti Aisyah',
        file: eSignFiles[1],
        signatureType: SignatureType.SIGNATURE2,
      },
    ];
    for (const sig of signatures) {
      const multerFile: Express.Multer.File = {
        buffer: sig.file.buffer,
        originalname: sig.file.originalname,
        mimetype: getMimeType(sig.file.originalname),
        size: sig.file.buffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
        stream: undefined as any, // TypeScript workaround
      };
      const { fileId } = await fileUploadService.uploadFile(
        multerFile,
        sig.idNumber,
        sig.file.subfolder,
        false
      );
      await prismaService.signature.create({
        data: {
          idNumber: sig.idNumber,
          role: sig.role,
          name: sig.name,
          eSignId: fileId,
          signatureType: sig.signatureType,
          status: true,
        },
      });
    }
    console.log('Signatures seeded successfully.');
  }
}

// Fungsi bantu untuk menentukan MIME type
/**
 *
 * @param filename
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

/**
 *
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const fileUploadService = app.get(FileUploadService);
  try {
    await seedDatabase(prisma, fileUploadService);
  } catch (e) {
    console.error('Seeding failed:', e);
    process.exit(1);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main();
