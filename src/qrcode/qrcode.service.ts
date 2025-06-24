import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { Participant } from '@prisma/client';
import { UrlHelper } from 'src/common/helpers/url.helper';
import * as QRCode from 'qrcode';
import { getFileBufferFromMinio } from '../common/helpers/minio.helper';
import { Client as MinioClient } from 'minio';
import { FileUploadService } from '../file-upload/file-upload.service';

const minio = new MinioClient({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: Number(process.env.MINIO_PORT!),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});
const minioBucket = process.env.MINIO_BUCKET!;

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly urlHelper: UrlHelper,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Mengambil QR code untuk seorang peserta.
   * Jika link QR code sudah usang (tidak cocok dengan URL frontend saat ini) atau belum ada,
   * maka akan membuat yang baru, menyimpannya, dan mengembalikannya.
   * @param participantId - ID dari peserta
   * @returns Buffer gambar QR code dalam format PNG.
   */
  async getOrRegenerateQrCodeForParticipant(
    participantId: string,
  ): Promise<Buffer> {
    const participant = await this.prismaService.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      this.logger.warn(`Peserta dengan ID: ${participantId} tidak ditemukan`);
      throw new HttpException('Peserta tidak ditemukan', 404);
    }

    // Sanitasi nama peserta
    const sanitizedNama = participant.name
      ? participant.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
      : 'Participant';
    const qrCodeFileName = `qrcode/QRCode_${sanitizedNama}_${participant.id}.png`;
    const frontendUrl = this.urlHelper.getBaseUrl('frontend');
    const expectedQrCodeLink = `${frontendUrl}/participants/${participant.id}/detail`;

    // Cek jika QR code perlu diregenerasi
    if (!participant.qrCodePath || participant.qrCodePath !== qrCodeFileName) {
      this.logger.log(
        `Meregenerasi QR code untuk peserta ID: ${participantId}. Path lama: ${participant.qrCodePath}, Path baru: ${qrCodeFileName}`,
      );
      return this.generateAndSaveQrCode(participant, expectedQrCodeLink, qrCodeFileName);
    }

    this.logger.debug(
      `Mengembalikan QR code yang ada untuk peserta ID: ${participantId}`,
    );
    const { buffer: qrCodeBuffer } = await this.fileUploadService.downloadFile(participant.qrCodePath);
    return qrCodeBuffer;
  }

  /**
   * Fungsi internal untuk membuat QR code, menyimpannya ke DB, dan mengembalikan buffer.
   * @param participant - Objek peserta
   * @param qrCodeLink - Link yang akan di-encode
   * @param qrCodeFileName - Nama file QR code di Minio
   * @returns Buffer gambar QR code
   */
  private async generateAndSaveQrCode(
    participant: Participant,
    qrCodeLink: string,
    qrCodeFileName: string,
  ): Promise<Buffer> {
    let qrCodeBuffer: Buffer;
    try {
      const qrCodeBase64 = await QRCode.toDataURL(qrCodeLink, { width: 500 });
      qrCodeBuffer = Buffer.from(
        qrCodeBase64.replace(/^data:image\/png;base64,/, ''),
        'base64',
      );
    } catch (error) {
      this.logger.error(
        `Gagal menghasilkan QR code untuk peserta ID: ${participant.id}`,
        error.stack,
      );
      throw new HttpException('Gagal menghasilkan QR code', 500);
    }

    // Upload ke storage dinamis
    const storageType = process.env.STORAGE_TYPE || 'minio';
    if (storageType === 'supabase') {
      await this.fileUploadService.uploadFile({
        buffer: qrCodeBuffer,
        size: qrCodeBuffer.length,
        mimetype: 'image/png',
        originalname: qrCodeFileName,
        fieldname: 'qrCode',
        encoding: '7bit',
        stream: undefined,
        destination: '',
        filename: qrCodeFileName,
        path: '',
      } as any, qrCodeFileName);
    } else {
      await minio.putObject(minioBucket, qrCodeFileName, qrCodeBuffer);
    }

    // Update peserta dengan path file
    await this.prismaService.participant.update({
      where: { id: participant.id },
      data: {
        qrCodePath: qrCodeFileName,
      },
    });

    this.logger.debug(
      `QR code untuk peserta ID: ${participant.id} berhasil diperbarui di database dan diupload ke storage`,
    );
    return qrCodeBuffer;
  }
} 