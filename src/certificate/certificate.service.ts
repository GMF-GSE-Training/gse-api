import { HttpException, Injectable, Logger } from '@nestjs/common';
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
        // Tambahkan untuk mengecek sertifikat yang sudah ada
        certificate: {
          where: {
              // Cek berdasarkan participant melalui participantsCots
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
    currentDate.setHours(0, 0, 0, 0); // Reset time untuk perbandingan tanggal saja
    
    const endDate = new Date(cot.endDate);
    endDate.setHours(0, 0, 0, 0); // Reset time untuk perbandingan tanggal saja
    
    if (currentDate <= endDate) {
        throw new HttpException('Gagal membuat sertifikat. COT belum selesai', 400);
    }
    // Validasi 2: Cek apakah sertifikat untuk participant di COT ini sudah ada
    const existingCertificate = await this.prismaService.certificate.findFirst({
      where: {
          cotId: cotId,
          participantId: participantId,
      },
  });

    if (existingCertificate) {
        throw new HttpException('Gagal membuat sertifikat. Sertifikat untuk participant sudah ada di COT ini', 409);
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

    // Generate certificate number
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

    // Enhanced Puppeteer configuration with cross-platform support
    const puppeteerOptions: any = {
      headless: 'new', // Use new headless mode
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

    // Try to find Chrome executable for different platforms
    const possiblePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser', 
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];

    // Check if Chrome exists in system PATH or use bundled Chromium
    for (const chromePath of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(chromePath)) {
          puppeteerOptions.executablePath = chromePath;
          break;
        }
      } catch (error) {
        // Continue checking other paths
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
      
      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 800 });
      
      // Set content with enhanced options
      await page.setContent(certificate, { 
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 30000 // 30 second timeout
      });

      // Generate PDF with enhanced options
      certificateBuffer = await page.pdf({
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

      await browser.close();
      this.logger.log('PDF generated successfully');
      
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

    // Upload PDF file
    let certificatePath: string;
    try {
      this.logger.log(`Uploading certificate PDF file...`);
      const fileObj = {
        buffer: certificateBuffer,
        originalname: `certificates/certificate_${certificateNumber}.pdf`,
        mimetype: 'application/pdf',
        size: certificateBuffer.length,
      };
      
      certificatePath = await this.fileUploadService.uploadFile(fileObj as any, fileObj.originalname);
      this.logger.log(`Certificate PDF file uploaded, path: ${certificatePath}`);
    } catch (err) {
      this.logger.error(`Gagal upload certificate PDF file: ${err.message}`);
      throw new HttpException(`Gagal upload certificate PDF file: ${err.message}`, 500);
    }

    // Simpan data sertifikat ke database
    const activeSignature = eSign[0];
    
    await this.prismaService.certificate.create({
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

    return 'Sertifikat berhasil dibuat';
  }

  async getCertificate(certificateId: string): Promise<any> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      }
    });

    if (!certificate) {
      throw new HttpException('Sertifikat tidak ditemukan', 404);
    }

    return certificate;
  }

  async streamFile(certificateId: string): Promise<Buffer> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
    });

    if (!certificate || !certificate.certificatePath) {
      throw new HttpException('File Sertifikat tidak ditemukan', 404);
    }

    // Ambil file dari storage dinamis (satu jalur)
    try {
      const { buffer } = await this.fileUploadService.downloadFile(certificate.certificatePath);
      return buffer;
    } catch (err: any) {
      if (err.status === 404) {
        throw new HttpException('File Sertifikat tidak ditemukan', 404);
      }
      throw new HttpException('Gagal mengambil file Sertifikat: ' + (err.message || err), 500);
    }
  }

  async deleteCertificate(certificateId: string): Promise<string> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
    });

    if (!certificate) {
      throw new HttpException('Sertifikat tidak ditemukan', 404);
    }

    this.fileUploadService.deleteFile(certificate.certificatePath);

    await this.prismaService.certificate.delete({
      where: {
        id: certificate.id,
      },
    });

    

    return 'Sertifikat berhadil dihapus';
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
