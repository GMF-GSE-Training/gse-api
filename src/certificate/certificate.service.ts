import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import { CreateCertificate } from 'src/model/certificate.model';
import { CurrentUserRequest } from 'src/model/auth.model';
import { CertificateValidation } from './certificate.validation';
import { join } from 'path';
import * as ejs from 'ejs';
import puppeteer from 'puppeteer';
import { getFileBufferFromMinio } from '../common/helpers/minio.helper';
import { FileUploadService } from '../file-upload/file-upload.service';

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
  ): Promise<string> {
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
                id: true,
                name: true,
                fotoPath: true,
                qrCodePath: true,
                qrCodeLink: true,
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
        certificate: {
          where: {
            cot: {
              participantsCots: {
                some: {
                  participantId: participantId,
                },
              },
            },
          },
          select: {
            id: true,
            certificateNumber: true,
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

    // Validasi 1: Cek apakah COT sudah selesai (endDate sudah terlewat)
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(cot.endDate);
    endDate.setHours(0, 0, 0, 0);

    if (currentDate <= endDate) {
      throw new HttpException('Gagal membuat sertifikat. COT belum selesai', 400);
    }

    // Validasi 2: Cek apakah sertifikat untuk participant ini di COT ini sudah ada
    const existingCertificate = await this.prismaService.certificate.findFirst({
      where: {
        cotId: cotId,
        participantId: participantId,
      },
    });

    if (existingCertificate) {
      throw new HttpException('Gagal membuat sertifikat. Sertifikat untuk participant ini sudah ada di COT ini', 409);
    }

    // Validasi 3: Cek apakah participant terdaftar di COT ini
    if (!cot.participantsCots || cot.participantsCots.length === 0) {
      throw new HttpException('Gagal membuat sertifikat. Participant tidak terdaftar di COT ini', 404);
    }

    const eSign = await this.prismaService.signature.findMany({
      where: {
        status: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
        eSignPath: true,
        signatureType: true,
      },
    });

    if (!eSign || eSign.length === 0) {
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

    let photoBuffer: Buffer;
    try {
      const { buffer } = await this.fileUploadService.downloadFile(participant.fotoPath);
      photoBuffer = buffer;
    } catch (err: any) {
      throw new Error('Gagal mengambil foto peserta: ' + (err.message || err));
    }
    const photoBase64 = photoBuffer.toString('base64');
    const photoType = this.getMediaType(photoBuffer);

    let qrCodeBuffer: Buffer;
    try {
      this.logger.debug('participant.qrCodePath: ' + participant.qrCodePath);
      const { buffer } = await this.fileUploadService.downloadFile(participant.qrCodePath);
      qrCodeBuffer = buffer;
    } catch (err: any) {
      this.logger.warn('QR Code tidak ditemukan, mencoba generate QR Code baru', err.message);
      try {
        // Generate QR code as fallback if file not found
        const QRCode = require('qrcode');
        const qrCodeUrl = participant.qrCodeLink || `${process.env.FRONTEND_URL}/participant/detail/${participant.id}`;
        qrCodeBuffer = await QRCode.toBuffer(qrCodeUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        // Optional: Upload the generated QR code back to storage for future use
        try {
          const qrFileObj: Express.Multer.File = {
            fieldname: 'qrcode',
            originalname: `qrcode_${participant.id}.png`,
            encoding: '7bit',
            mimetype: 'image/png',
            buffer: qrCodeBuffer,
            size: qrCodeBuffer.length,
            destination: '',
            filename: `qrcode_${participant.id}.png`,
            path: '',
            stream: undefined
          };
          await this.fileUploadService.uploadFile(qrFileObj, participant.qrCodePath);
          this.logger.log(`QR Code berhasil di-generate dan di-upload: ${participant.qrCodePath}`);
        } catch (uploadErr) {
          this.logger.warn('QR Code berhasil di-generate tapi gagal di-upload ke storage', uploadErr.message);
        }
      } catch (qrGenErr: any) {
        throw new Error('Gagal mengambil atau generate QR Code peserta: ' + (qrGenErr.message || qrGenErr));
      }
    }
    const qrCodeBase64 = qrCodeBuffer.toString('base64');
    const qrCodeType = this.getMediaType(qrCodeBuffer);

    const signature1 = eSign.find(
      (item) => item.signatureType === 'SIGNATURE1',
    );
    let signature1Buffer: Buffer;
    try {
      const { buffer } = await this.fileUploadService.downloadFile(signature1.eSignPath);
      signature1Buffer = buffer;
    } catch (err: any) {
      throw new Error('Gagal mengambil signature1: ' + (err.message || err));
    }
    const signature1Base64 = signature1Buffer.toString('base64');
    const signature1Type = this.getMediaType(signature1Buffer);

    const signature2 = eSign.find(
      (item) => item.signatureType === 'SIGNATURE2',
    );
    let signature2Buffer: Buffer;
    try {
      const { buffer } = await this.fileUploadService.downloadFile(signature2.eSignPath);
      signature2Buffer = buffer;
    } catch (err: any) {
      throw new Error('Gagal mengambil signature2: ' + (err.message || err));
    }
    const signature2Base64 = signature2Buffer.toString('base64');
    const signature2Type = this.getMediaType(signature2Buffer);

    const formattedStartDate = this.formatDate(new Date(cot.startDate));
    const formattedEndDate = this.formatDate(new Date(cot.endDate));
    const formattedDateOfBirth = this.formatDate(
      new Date(participant.dateOfBirth),
    );

    const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const backgroundImage = `${process.env.BACKEND_URL}/assets/images/background_sertifikat.png`;
    const templatePath = join(
      __dirname,
      '..',
      'templates',
      'certificate',
      'certificate.ejs',
    );
    const certificate = await ejs.renderFile(templatePath, {
      backgroundImage: backgroundImage,
      photoType: photoType,
      photoBase64: photoBase64,
      qrCodeType: qrCodeType,
      qrCodeBase64: qrCodeBase64,
      name: participant.name,
      placeOrDateOfBirth: `${participant.placeOfBirth}/${formattedDateOfBirth}`,
      nationality: participant.nationality,
      competencies: capability.trainingName,
      date: this.formatDate(new Date()),
      certificateNumber: certificateNumber,
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

    const puppeteerOptions: any = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    };

    const possiblePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];

    for (const chromePath of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(chromePath)) {
          puppeteerOptions.executablePath = chromePath;
          break;
        }
      } catch (error) {
      }
    }

    let browser;
    try {
      this.logger.log('Launching Puppeteer with options:', puppeteerOptions);
      browser = await puppeteer.launch(puppeteerOptions);
    } catch (error) {
      this.logger.error('Failed to launch Puppeteer:', error.message);
      throw new HttpException(
        `Gagal menjalankan PDF generator: ${error.message}. Pastikan Chrome ter-install di sistem.`,
        500
      );
    }

    let certificateBuffer: Buffer;
    try {
      const page = await browser.newPage();

      await page.setViewport({ width: 1200, height: 800 });

      await page.setContent(certificate, {
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 30000
      });

      const pdfResult = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        }
      });

      certificateBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : Buffer.from(pdfResult);

      this.logger.log('PDF generated successfully', {
        originalType: pdfResult.constructor.name,
        convertedType: certificateBuffer.constructor.name,
        size: certificateBuffer.length
      });

      await browser.close();

    } catch (error) {
      if (browser) {
        await browser.close();
      }
      this.logger.error('Failed to generate PDF:', error.message);
      throw new HttpException(
        `Gagal generate PDF certificate: ${error.message}`,
        500
      );
    }

    if (!certificateBuffer || !Buffer.isBuffer(certificateBuffer)) {
      this.logger.error('Invalid certificate buffer generated');
      throw new HttpException(
        'Gagal generate PDF certificate: Invalid buffer generated',
        500
      );
    }

    if (certificateBuffer.length === 0) {
      this.logger.error('Empty certificate buffer generated');
      throw new HttpException(
        'Gagal generate PDF certificate: Empty buffer generated',
        500
      );
    }

    const pdfSignatureBytes = certificateBuffer.subarray(0, 5);
    const pdfSignature = String.fromCharCode(...pdfSignatureBytes);

    this.logger.debug('PDF signature validation', {
      signatureBytes: Array.from(pdfSignatureBytes),
      signatureString: pdfSignature,
      bufferStart: certificateBuffer.subarray(0, 20).toString('hex'),
      isValidPDF: pdfSignature.startsWith('%PDF')
    });

    if (!pdfSignature.startsWith('%PDF')) {
      this.logger.error('Invalid PDF buffer generated', {
        signature: pdfSignature,
        signatureBytes: Array.from(pdfSignatureBytes),
        bufferStart: certificateBuffer.subarray(0, 20).toString('hex')
      });
      throw new HttpException(
        'Gagal generate PDF certificate: Invalid PDF format generated',
        500
      );
    }

    let certificatePath: string;
    try {
      this.logger.log(`Uploading certificate PDF file...`, {
        bufferSize: certificateBuffer.length,
        platform: process.platform,
        pdfValid: pdfSignature.includes('%PDF')
      });

      const fileObj: Express.Multer.File = {
        fieldname: 'certificate',
        originalname: `certificate_${certificateNumber}.pdf`,
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: certificateBuffer,
        size: certificateBuffer.length,
        destination: '',
        filename: `certificate_${certificateNumber}.pdf`,
        path: '',
        stream: undefined
      };

      const uploadPath = `certificates/certificate_${certificateNumber}.pdf`
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\//, '');

      certificatePath = await this.fileUploadService.uploadFile(fileObj, uploadPath);

      this.logger.log(`Certificate PDF file uploaded successfully`, {
        path: certificatePath,
        size: certificateBuffer.length,
        platform: process.platform
      });

    } catch (err: any) {
      this.logger.error(`Certificate PDF upload failed:`, {
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 5),
        bufferSize: certificateBuffer?.length,
        bufferValid: Buffer.isBuffer(certificateBuffer),
        platform: process.platform,
        storageType: process.env.STORAGE_TYPE,
        nodeVersion: process.version
      });

      let errorMessage = `Gagal upload certificate PDF file: ${err.message}`;

      if (err.message.includes('stream.Readable')) {
        errorMessage += ' - Buffer format issue detected. Please check storage configuration.';
      }

      if (err.message.includes('third argument')) {
        errorMessage += ' - Storage provider compatibility issue. Try switching to MinIO for development.';
      }

      throw new HttpException(errorMessage, 500);
    }

    const activeSignature = eSign[0];

    const newCertificate = await this.prismaService.certificate.create({
      data: {
        cotId: cotId,
        participantId: participantId,
        signatureId: activeSignature.id,
        certificateNumber: certificateNumber,
        attendance: createCertificateRequest.attendance,
        theoryScore: createCertificateRequest.theoryScore,
        practiceScore: createCertificateRequest.practiceScore,
        certificatePath: certificatePath,
      },
    });

    return newCertificate.id;
  }

  async getCertificate(certificateId: string, user: CurrentUserRequest): Promise<any> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
      include: {
        participant: {
          select: {
            id: true,
            name: true,
            idNumber: true,
          }
        }
      }
    });

    if (!certificate) {
      throw new HttpException('Sertifikat tidak ditemukan', 404);
    }

    // Check authorization for user role
    if (user.role.name === 'user' && user.participantId !== certificate.participant.id) {
      throw new HttpException('Anda tidak punya izin untuk melihat sertifikat ini', 403);
    }

    return certificate;
  }

  async checkCertificateByParticipant(cotId: string, participantId: string): Promise<any> {
    const certificate = await this.prismaService.certificate.findFirst({
      where: {
        cotId: cotId,
        participantId: participantId,
      },
      include: {
        participant: true,
        cot: true
      }
    });

    return certificate;
  }

  async streamFile(certificateId: string, user: CurrentUserRequest): Promise<Buffer> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
      select: {
        id: true,
        certificatePath: true,
        certificateNumber: true,
        participant: {
          select: {
            id: true,
            name: true,
            idNumber: true,
          }
        }
      }
    });

    if (!certificate) {
      throw new HttpException('File Sertifikat tidak ditemukan', 404);
    }

    if (!certificate.certificatePath) {
      throw new HttpException('Path file sertifikat tidak ditemukan', 404);
    }

    // Check authorization for user role
    if (user.role.name === 'user' && user.participantId !== certificate.participant.id) {
      throw new HttpException('Anda tidak punya izin untuk melihat file sertifikat ini', 403);
    }

    // Download certificate file from storage
    try {
      this.logger.debug(`Downloading certificate file: ${certificate.certificatePath}`);
      const { buffer } = await this.fileUploadService.downloadFile(certificate.certificatePath);
      
      this.logger.log(`Certificate file downloaded successfully`, {
        certificateId: certificate.id,
        certificateNumber: certificate.certificateNumber,
        path: certificate.certificatePath,
        size: buffer.length
      });
      
      return buffer;
    } catch (err: any) {
      this.logger.error(`Failed to download certificate file`, {
        certificateId: certificate.id,
        certificatePath: certificate.certificatePath,
        error: err.message
      });
      throw new HttpException(`Gagal download file sertifikat: ${err.message}`, 500);
    }
  }

  async deleteCertificate(certificateId: string): Promise<string> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
      select: {
        id: true,
        certificatePath: true,
        certificateNumber: true
      }
    });

    if (!certificate) {
      throw new HttpException('Sertifikat tidak ditemukan', 404);
    }

    // Delete certificate file from storage if exists
    if (certificate.certificatePath) {
      try {
        await this.fileUploadService.deleteFile(certificate.certificatePath);
        this.logger.log(`Certificate file deleted from storage: ${certificate.certificatePath}`);
      } catch (err: any) {
        this.logger.warn(`Failed to delete certificate file from storage`, {
          certificatePath: certificate.certificatePath,
          error: err.message
        });
        // Don't throw error here, continue with database deletion
      }
    }

    // Delete certificate record from database
    await this.prismaService.certificate.delete({
      where: {
        id: certificate.id,
      },
    });

    this.logger.log(`Certificate deleted successfully`, {
      certificateId: certificate.id,
      certificateNumber: certificate.certificateNumber
    });

    return 'Sertifikat berhasil dihapus';
  }

  private getMediaType(buffer: Buffer): string {
    const header = buffer.toString('hex', 0, 4);
    if (header.startsWith('89504e47')) return 'image/png';
    if (header.startsWith('ffd8ff')) return 'image/jpeg';
    if (header.startsWith('25504446')) return 'application/pdf';
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
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
}

