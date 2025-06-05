import * as fs from 'fs/promises';
import * as path from 'path';

import { ConfigService } from '@nestjs/config';

import { PrismaClient } from '@prisma/client';
import * as QRCode from 'qrcode';

/**
 * Mengatur environment dan memuat konfigurasi dari file .env berdasarkan NODE_ENV.
 */
const env = process.env.NODE_ENV || 'development';
require('dotenv').config({
  path: path.resolve(__dirname, '../', `.env.${env}`),
});

const prisma = new PrismaClient();
const configService = new ConfigService();

/**
 * Migrasi untuk memperbarui qrCodeLink di tabel Participant agar sesuai dengan FRONTEND_URL terbaru.
 * QR code disimpan sebagai file di folder lokal dan metadata direferensikan melalui FileMetadata.
 * @throws {Error} Jika FRONTEND_URL tidak ditemukan atau terjadi kesalahan selama migrasi.
 */
async function migrateQrCodeFrontendUrl() {
  try {
    // Validasi FRONTEND_URL
    const frontendUrl = configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL tidak ditemukan di konfigurasi .env');
    }

    // Ambil semua participant yang qrCodeLink-nya perlu diperbarui
    const participants = await prisma.participant.findMany({
      where: {
        OR: [
          { qrCodeLink: null },
          { qrCodeLink: { not: { startsWith: frontendUrl } } },
        ],
      },
      include: { qrCode: true }, // Sertakan relasi qrCode untuk pengecekan
    });

    // Siapkan folder lokal untuk menyimpan QR code
    const qrCodeDir = path.resolve(__dirname, '../', 'public/qrcodes');
    await fs.mkdir(qrCodeDir, { recursive: true });

    for (const participant of participants) {
      const newQrCodeLink = `${frontendUrl}/participants/${participant.id}/detail`;
      const qrCodeFileName = `qrcode_${participant.id}.png`;
      const qrCodeFilePath = path.join(qrCodeDir, qrCodeFileName);

      // Generate dan simpan QR code ke folder lokal
      await QRCode.toFile(qrCodeFilePath, newQrCodeLink, {
        width: 500,
        type: 'png',
      });

      // Upsert FileMetadata untuk QR code
      const qrCodeMetadata = await prisma.fileMetadata.upsert({
        where: { path: qrCodeFilePath }, // Unik berdasarkan path
        create: {
          path: qrCodeFilePath,
          fileName: qrCodeFileName, // Nama file untuk referensi tampilan
          mimeType: 'image/png',
          storageType: 'local', // Jenis storage
          isSensitive: false,
          createdAt: new Date(),
        },
        update: {
          path: qrCodeFilePath,
          fileName: qrCodeFileName, // Update nama file jika berubah
          mimeType: 'image/png',
        },
      });

      // Perbarui Participant dengan qrCodeId dan qrCodeLink baru
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          qrCode: {
            connect: { id: qrCodeMetadata.id }, // Hubungkan ke FileMetadata
          },
          qrCodeLink: newQrCodeLink,
        },
      });

      console.log(
        `Updated participant ID: ${participant.id} with QR code at ${qrCodeFilePath}`
      );
    }

    console.log(
      'Migrasi selesai. Total participants diperbarui: ',
      participants.length
    );
  } catch (error) {
    console.error('Error selama migrasi:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Menjalankan migrasi dan menangani error fatal.
 */
migrateQrCodeFrontendUrl().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
