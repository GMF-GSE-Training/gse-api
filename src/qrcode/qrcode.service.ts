import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { Participant } from '@prisma/client';
import { UrlHelper } from 'src/common/helpers/url.helper';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly urlHelper: UrlHelper,
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

    const frontendUrl = this.urlHelper.getBaseUrl('frontend');
    const expectedQrCodeLink = `${frontendUrl}/participants/${participant.id}/detail`;

    // Cek jika QR code perlu diregenerasi
    if (
      !participant.qrCode ||
      !participant.qrCodeLink ||
      participant.qrCodeLink !== expectedQrCodeLink
    ) {
      this.logger.log(
        `Meregenerasi QR code untuk peserta ID: ${participantId}. Link lama: ${participant.qrCodeLink}, Link baru: ${expectedQrCodeLink}`,
      );
      return this.generateAndSaveQrCode(participant, expectedQrCodeLink);
    }

    this.logger.debug(
      `Mengembalikan QR code yang ada untuk peserta ID: ${participantId}`,
    );
    return Buffer.from(participant.qrCode);
  }

  /**
   * Fungsi internal untuk membuat QR code, menyimpannya ke DB, dan mengembalikan buffer.
   * @param participant - Objek peserta
   * @param qrCodeLink - Link yang akan di-encode
   * @returns Buffer gambar QR code
   */
  private async generateAndSaveQrCode(
    participant: Participant,
    qrCodeLink: string,
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

    // Update peserta dengan QR code dan link baru
    await this.prismaService.participant.update({
      where: { id: participant.id },
      data: {
        qrCode: qrCodeBuffer,
        qrCodeLink: qrCodeLink,
      },
    });

    this.logger.debug(
      `QR code untuk peserta ID: ${participant.id} berhasil diperbarui di database`,
    );
    return qrCodeBuffer;
  }
} 