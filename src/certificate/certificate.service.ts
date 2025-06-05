import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/service/prisma.service.js';
import { ValidationService } from '../common/service/validation.service.js';
import { FileUploadService } from '../file-upload/file-upload.service.js';
import { CreateCertificate } from '../model/certificate.model.js';
import { CertificateValidation } from './certificate.validation.js';
import { join } from 'path';
import * as ejs from 'ejs';
import puppeteer from 'puppeteer';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async createCertificate(
    cotId: string,
    participantId: string,
    request: CreateCertificate,
  ): Promise<Buffer> {
    this.logger.log(`Creating certificate for participant ${participantId} in COT ${cotId}`);

    // Validasi request
    const createCertificateRequest = this.validationService.validate(
      CertificateValidation.CREATE,
      request,
    );

    // Ambil data COT dengan relasi
    const cot = await this.prismaService.cOT.findUnique({
      where: { id: cotId },
      include: {
        participantsCots: {
          where: { participantId },
          include: {
            participant: {
              include: { foto: true },
            },
          },
        },
        capabilityCots: {
          include: {
            capability: {
              include: { curriculumSyllabus: true },
            },
          },
        },
      },
    });

    if (!cot || cot.participantsCots.length === 0) {
      this.logger.error('COT or participant not found');
      throw new HttpException('COT atau peserta tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    const participant = cot.participantsCots[0].participant;
    const capability = cot.capabilityCots[0].capability;

    // Ambil eSign aktif
    const eSigns = await this.prismaService.signature.findMany({
      where: { status: true },
      include: { eSign: true },
    });

    if (!eSigns || eSigns.length < 2) {
      this.logger.error('Insufficient active eSigns');
      throw new HttpException('Tidak ada eSign aktif yang cukup', HttpStatus.NOT_FOUND);
    }

    const signature1 = eSigns.find((item) => item.signatureType === 'SIGNATURE1');
    const signature2 = eSigns.find((item) => item.signatureType === 'SIGNATURE2');

    if (!signature1 || !signature2) {
      this.logger.error('Missing SIGNATURE1 or SIGNATURE2');
      throw new HttpException('E-Sign untuk SIGNATURE1 atau SIGNATURE2 tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    // Validasi file
    if (!participant.foto) {
      this.logger.error('Participant photo not found');
      throw new HttpException('Foto peserta tidak ditemukan', HttpStatus.NOT_FOUND);
    }
    if (!signature1.eSign) {
      this.logger.error('SIGNATURE1 eSign file not found');
      throw new HttpException('File E-Sign SIGNATURE1 tidak ditemukan', HttpStatus.NOT_FOUND);
    }
    if (!signature2.eSign) {
      this.logger.error('SIGNATURE2 eSign file not found');
      throw new HttpException('File E-Sign SIGNATURE2 tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    // Ambil buffer dan mimeType
    const photoData = await this.fileUploadService.getFile(participant.foto.id);
    const signature1Data = await this.fileUploadService.getFile(signature1.eSign.id);
    const signature2Data = await this.fileUploadService.getFile(signature2.eSign.id);

    // Konversi ke base64
    const photoBase64 = photoData.buffer.toString('base64');
    const signature1Base64 = signature1Data.buffer.toString('base64');
    const signature2Base64 = signature2Data.buffer.toString('base64');

    const photoType = photoData.mimeType;
    const signature1Type = signature1Data.mimeType;
    const signature2Type = signature2Data.mimeType;

    // Format tanggal
    const formattedStartDate = this.formatDate(new Date(cot.startDate));
    const formattedEndDate = this.formatDate(new Date(cot.endDate));
    const formattedDateOfBirth = this.formatDate(new Date(participant.dateOfBirth));

    // Filter regulasi dan kompetensi
    const GSERegulation = capability.curriculumSyllabus.filter((item) => item.type === 'Regulasi GSE');
    const Competencies = capability.curriculumSyllabus.filter((item) => item.type === 'Kompetensi');

    // Generate nomor sertifikat
    const certificateNumber = this.generateCertificateNumber(cotId, participantId);

    // Render template EJS
    const templatePath = join(__dirname, '..', 'templates', 'certificate', 'certificate.ejs');
    const certificateHtml = await ejs.renderFile(templatePath, {
      photoType,
      photoBase64,
      name: participant.name,
      placeOrDateOfBirth: `${participant.placeOfBirth}/${formattedDateOfBirth}`,
      nationality: participant.nationality,
      competencies: capability.trainingName,
      date: this.formatDate(new Date()),
      certificateNumber,
      duration: capability.totalDuration,
      coursePeriode: `${formattedStartDate} - ${formattedEndDate}`,
      nameSignature1: signature1.name,
      roleSignature1: signature1.role,
      signature1Type,
      signature1Base64,
      nameSignature2: signature2.name,
      roleSignature2: signature2.role,
      signature2Type,
      signature2Base64,
      GSERegulation,
      Competencies,
      totalDuration: capability.totalDuration,
      theoryScore: createCertificateRequest.theoryScore,
      practiceScore: createCertificateRequest.practiceScore,
    });

    // Generate PDF
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(certificateHtml, { waitUntil: 'load' });
    const certificateUint8Array = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
    });
    const certificateBuffer = Buffer.from(certificateUint8Array);
    await browser.close();

    // Simpan sertifikat ke FileUploadService
    const { fileId } = await this.fileUploadService.uploadFile(
      {
        buffer: certificateBuffer,
        originalname: `certificate_${certificateNumber}.pdf`,
        mimetype: 'application/pdf',
        size: certificateBuffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
        stream: undefined as any,
      },
      participantId,
      'certificates',
      false,
    );

    // Simpan ke model Certificate
    await this.prismaService.certificate.create({
      data: {
        cotId,
        signatureId: signature1.id, // Gunakan signature1 sebagai default
        participantId,
        certificateNumber,
        attendance: true,
        theoryScore: createCertificateRequest.theoryScore,
        practiceScore: createCertificateRequest.practiceScore,
        fileId, // Relasi ke FileMetadata
      },
    });

    this.logger.log(`Certificate ${certificateNumber} created and saved successfully`);
    return certificateBuffer;
  }

  private formatDate(date: Date): string {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  private generateCertificateNumber(cotId: string, participantId: string): string {
    const timestamp = Date.now().toString().slice(-6);
    return `CERT-${cotId.slice(0, 4).toUpperCase()}-${participantId.slice(0, 4).toUpperCase()}-${timestamp}`;
  }
}