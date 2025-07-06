import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import { CreateCertificate } from 'src/model/certificate.model';
import { CertificateValidation } from './certificate.validation';
import { join } from 'path';
import * as ejs from 'ejs';
import puppeteer from 'puppeteer';
import { getFileBufferFromMinio } from '../common/helpers/minio.helper';
import { FileUploadService } from '../file-upload/file-upload.service';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async createCertificate(
    cotId: string,
    participantId: string,
    request: CreateCertificate,
  ): Promise<any> {
    const createCertificateRequest = this.validationService.validate(
      CertificateValidation.CREATE,
      request,
    );

    const cot = await this.prismaService.cOT.findUnique({
      where: {
        id: cotId,
      },
      select: {
        startDate: true,
        endDate: true,
        participantsCots: {
          where: {
            participantId: participantId, // Filter relasi berdasarkan participantId
          },
          select: {
            participant: {
              select: {
                name: true,
                fotoPath: true,
                placeOfBirth: true,
                dateOfBirth: true,
                nationality: true,
              },
            },
          },
        },
        capabilityCots: {
          select: {
            capability: {
              select: {
                trainingName: true,
                totalDuration: true,
                curriculumSyllabus: {
                  select: {
                    type: true,
                    name: true,
                    theoryDuration: true,
                    practiceDuration: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cot) {
      throw new HttpException(
        'Gagal membuat sertifikat. COT tidak ditemukan',
        404,
      );
    }

    const eSign = await this.prismaService.signature.findMany({
      where: {
        status: true,
      },
      select: {
        name: true,
        role: true,
        eSignPath: true,
        signatureType: true,
      },
    });

    if (!eSign) {
      throw new HttpException(
        'Gagal membuat sertifikat. Tidak ada Esign yang aktif',
        404,
      );
    }

    const participant = cot.participantsCots[0].participant;
    const capability = cot.capabilityCots[0].capability;

    const GSERegulation = capability.curriculumSyllabus.filter(
      (item) => item.type === 'Regulasi GSE',
    );
    const Competencies = capability.curriculumSyllabus.filter(
      (item) => item.type === 'Kompetensi',
    );

    const storageType = process.env.STORAGE_TYPE || 'minio';
    let photoBuffer: Buffer;
    if (storageType === 'supabase') {
      const { buffer } = await this.fileUploadService.downloadFile(participant.fotoPath);
      photoBuffer = buffer;
    } else {
      photoBuffer = await getFileBufferFromMinio(participant.fotoPath);
    }
    const photoBase64 = photoBuffer.toString('base64');
    const photoType = this.getMediaType(photoBuffer);

    const signature1 = eSign.find(
      (item) => item.signatureType === 'SIGNATURE1',
    );
    let signature1Buffer: Buffer;
    if (storageType === 'supabase') {
      const { buffer } = await this.fileUploadService.downloadFile(signature1.eSignPath);
      signature1Buffer = buffer;
    } else {
      signature1Buffer = await getFileBufferFromMinio(signature1.eSignPath);
    }
    const signature1Base64 = signature1Buffer.toString('base64');
    const signature1Type = this.getMediaType(signature1Buffer);

    const signature2 = eSign.find(
      (item) => item.signatureType === 'SIGNATURE2',
    );
    let signature2Buffer: Buffer;
    if (storageType === 'supabase') {
      const { buffer } = await this.fileUploadService.downloadFile(signature2.eSignPath);
      signature2Buffer = buffer;
    } else {
      signature2Buffer = await getFileBufferFromMinio(signature2.eSignPath);
    }
    const signature2Base64 = signature2Buffer.toString('base64');
    const signature2Type = this.getMediaType(signature2Buffer);

    const formattedStartDate = this.formatDate(new Date(cot.startDate));
    const formattedEndDate = this.formatDate(new Date(cot.endDate));
    const formattedDateOfBirth = this.formatDate(
      new Date(participant.dateOfBirth),
    );

    const templatePath = join(
      __dirname,
      '..',
      'templates',
      'certificate',
      'certificate.ejs',
    );
    const certificate = await ejs.renderFile(templatePath, {
      photoType: photoType,
      photoBase64: photoBase64,
      name: participant.name,
      placeOrDateOfBirth: `${participant.placeOfBirth}/${formattedDateOfBirth}`,
      nationality: participant.nationality,
      competencies: capability.trainingName,
      date: this.formatDate(new Date()),
      certificateNumber: '12345',
      duration: capability.totalDuration,
      coursePeriode: `${formattedStartDate} - ${formattedEndDate}`,
      nameSignature1: signature1.name,
      roleSignature1: signature1.role,
      signature1Type: signature1Type,
      signature1Base64: signature1Base64,
      nameSignature2: signature2.name,
      roleSignature2: signature2.role,
      signature2Type: signature2Type,
      signature2Base64: signature2Base64,
      GSERegulation: GSERegulation,
      Competencies: Competencies,
      totalDuration: capability.totalDuration,
      theoryScore: createCertificateRequest.theoryScore,
      practiceScore: createCertificateRequest.practiceScore,
    });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(certificate, { waitUntil: 'load' });

    const certificateBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true, // Pastikan background termasuk dalam PDF
    });

    await browser.close();

    return Buffer.from(certificateBuffer);
  }

  private getMediaType(buffer: Buffer): string {
    const header = buffer.toString('hex', 0, 4);
    if (header.startsWith('89504e47')) return 'image/png'; // PNG
    if (header.startsWith('ffd8ff')) return 'image/jpeg'; // JPEG
    if (header.startsWith('25504446')) return 'application/pdf'; // PDF
    throw new Error('Unable to detect file type');
  }

  formatDate(date: Date): string {
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    const day = String(date.getDate()).padStart(2, '0'); // Tambahkan nol jika hari kurang dari 10
    const month = months[date.getMonth()]; // Ambil nama bulan dari array
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
}
