import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import { CertificateListResponse, CreateCertificate, UpdateCertificate } from 'src/model/certificate.model';
import { CertificateValidation } from './certificate.validation';
import { join } from 'path';
import * as ejs from 'ejs';
import puppeteer from 'puppeteer';
import { getFileBufferFromMinio } from '../common/helpers/minio.helper';
import { FileUploadService } from '../file-upload/file-upload.service';
import { ListRequest, Paging, ActionAccessRights } from 'src/model/web.model';
import { naturalSort } from 'src/common/helpers/natural-sort';
import { CoreHelper } from 'src/common/helpers/core.helper';
import { CurrentUserRequest } from 'src/model/auth.model';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly fileUploadService: FileUploadService,
    private readonly coreHelper: CoreHelper,
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
                qrCodePath: true,
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


    let qrCodeBuffer: Buffer;
    try {
      const { buffer } = await this.fileUploadService.downloadFile(participant.qrCodePath);
      qrCodeBuffer = buffer;
    } catch (err: any) {
      throw new Error('Gagal mengambil QR Code: ' + (err.message || err));
    }
    const qrCodeBase64 = qrCodeBuffer.toString('base64');

    const formattedStartDate = this.formatDate(new Date(cot.startDate));
    const formattedEndDate = this.formatDate(new Date(cot.endDate));
    const formattedDateOfBirth = this.formatDate(
      new Date(participant.dateOfBirth),
    );

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
      certificateNumber: createCertificateRequest.certificateNumber,
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
      qrCodeBase64: qrCodeBase64,
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
      
      // Convert Uint8Array to Buffer if necessary (Puppeteer returns Uint8Array)
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

    // Validate PDF buffer before upload
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
    
    // Verify PDF signature (Puppeteer returns bytes, need proper conversion)
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
    
    // Upload PDF file with enhanced validation and cross-platform support
    let certificatePath: string;
    try {
      this.logger.log(`Uploading certificate PDF file...`, {
        bufferSize: certificateBuffer.length,
        platform: process.platform,
        pdfValid: pdfSignature.includes('%PDF')
      });
      
      const safeCertificateNumber = createCertificateRequest.certificateNumber.replace(/\//g, '_');

      // Create proper Express.Multer.File object with Windows compatibility
      const fileObj: Express.Multer.File = {
        fieldname: 'certificate',
        originalname: `${safeCertificateNumber}.pdf`,
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: certificateBuffer,
        size: certificateBuffer.length,
        // Required fields for full compatibility
        destination: '',
        filename: `certificate_${createCertificateRequest.certificateNumber}.pdf`,
        path: '',
        stream: undefined
      };
      
      const uploadPath = `certificates/${safeCertificateNumber}.pdf`
        .replace(/\\/g, '/')  
        .replace(/\/+/g, '/') 
        .replace(/^\//, '');
      
      // Perform upload with enhanced error context
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
      
      // Enhanced error message for better debugging
      let errorMessage = `Gagal upload certificate PDF file: ${err.message}`;
      
      if (err.message.includes('stream.Readable')) {
        errorMessage += ' - Buffer format issue detected. Please check storage configuration.';
      }
      
      if (err.message.includes('third argument')) {
        errorMessage += ' - Storage provider compatibility issue. Try switching to MinIO for development.';
      }
      
      throw new HttpException(errorMessage, 500);
    }

    // Hitung expDate 6 bulan setelah cot.endDate
    const expirationDate = new Date(cot.endDate);
    expirationDate.setMonth(expirationDate.getMonth() + 6);

    // Simpan data sertifikat ke database
    const activeSignature = eSign[0];
    
    await this.prismaService.certificate.create({
      data: {
        cotId: cotId,
        participantId: participantId,
        signatureId: activeSignature.id,
        certificateNumber: createCertificateRequest.certificateNumber,
        theoryScore: createCertificateRequest.theoryScore,
        practiceScore: createCertificateRequest.practiceScore,
        expDate: expirationDate,
        certificatePath: certificatePath,
      },
    });

    return 'Sertifikat berhasil dibuat';
  }

  async getCertificate(certificateId: string): Promise<any> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
      include: {
        participant: {
          select: {
            idNumber: true,
            name: true,
          },
        },
        cot: {
          include: {
            capabilityCots: {
              take: 1,
              include: {
                capability: {
                  select: {
                    trainingName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!certificate) {
      throw new HttpException('Sertifikat tidak ditemukan', 404);
    }

    // Format response dengan hanya menambahkan 3 field baru tanpa nested object
    const { participant, cot, ...certificateData } = certificate;
    
    const response = {
      ...certificateData,
      noPegawai: participant?.idNumber || null,
      nama: participant?.name || null,
      namaTraining: cot?.capabilityCots[0]?.capability?.trainingName || null,
    };

    return response;
  }

  async updateCertificate(
    certificateId: string,
    request: UpdateCertificate,
  ): Promise<string> {
    const updateCertificateRequest = this.validationService.validate(
      CertificateValidation.UPDATE,
      request,
    );

    // Cari certificate dengan relasi yang diperlukan
    const existingCertificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
      include: {
        cot: {
          select: {
            startDate: true,
            endDate: true,
            participantsCots: {
              take: 1,
              select: {
                participant: {
                  select: {
                    name: true,
                    fotoPath: true,
                    qrCodePath: true,
                    placeOfBirth: true,
                    dateOfBirth: true,
                    nationality: true,
                  },
                },
              },
            },
            capabilityCots: {
              take: 1,
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
        },
        participant: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existingCertificate) {
      throw new HttpException('Sertifikat tidak ditemukan', 404);
    }

    // Tentukan apakah perlu generate ulang PDF
    const needsPdfRegeneration =
      (updateCertificateRequest.theoryScore !== undefined &&
        updateCertificateRequest.theoryScore !== existingCertificate.theoryScore) ||
      (updateCertificateRequest.practiceScore !== undefined &&
        updateCertificateRequest.practiceScore !== existingCertificate.practiceScore) ||
      (updateCertificateRequest.certificateNumber !== undefined &&
        updateCertificateRequest.certificateNumber !== existingCertificate.certificateNumber);

    let newCertificatePath = existingCertificate.certificatePath;
    const oldCertificatePath = existingCertificate.certificatePath;

    // Jika perlu generate ulang PDF
    if (needsPdfRegeneration) {
      const cot = existingCertificate.cot;
      const participant = cot.participantsCots[0]?.participant;
      const capability = cot.capabilityCots[0]?.capability;

      if (!participant || !capability) {
        throw new HttpException(
          'Gagal update sertifikat. Data COT, participant, atau capability tidak lengkap',
          404,
        );
      }

      // Ambil eSign aktif
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
          'Gagal update sertifikat. Tidak ada Esign yang aktif',
          404,
        );
      }

      // Gunakan nilai baru atau nilai lama
      const theoryScore =
        updateCertificateRequest.theoryScore !== undefined
          ? updateCertificateRequest.theoryScore
          : existingCertificate.theoryScore;
      const practiceScore =
        updateCertificateRequest.practiceScore !== undefined
          ? updateCertificateRequest.practiceScore
          : existingCertificate.practiceScore;
      const certificateNumber =
        updateCertificateRequest.certificateNumber !== undefined
          ? updateCertificateRequest.certificateNumber
          : existingCertificate.certificateNumber;

      // Ambil foto participant
      let photoBuffer: Buffer;
      try {
        const { buffer } = await this.fileUploadService.downloadFile(participant.fotoPath);
        photoBuffer = buffer;
      } catch (err: any) {
        throw new Error('Gagal mengambil foto peserta: ' + (err.message || err));
      }
      const photoBase64 = photoBuffer.toString('base64');
      const photoType = this.getMediaType(photoBuffer);

      // Ambil signature1
      const signature1 = eSign.find((item) => item.signatureType === 'SIGNATURE1');
      let signature1Buffer: Buffer;
      try {
        const { buffer } = await this.fileUploadService.downloadFile(signature1.eSignPath);
        signature1Buffer = buffer;
      } catch (err: any) {
        throw new Error('Gagal mengambil signature1: ' + (err.message || err));
      }
      const signature1Base64 = signature1Buffer.toString('base64');
      const signature1Type = this.getMediaType(signature1Buffer);

      // Ambil signature2
      const signature2 = eSign.find((item) => item.signatureType === 'SIGNATURE2');
      let signature2Buffer: Buffer;
      try {
        const { buffer } = await this.fileUploadService.downloadFile(signature2.eSignPath);
        signature2Buffer = buffer;
      } catch (err: any) {
        throw new Error('Gagal mengambil signature2: ' + (err.message || err));
      }
      const signature2Base64 = signature2Buffer.toString('base64');
      const signature2Type = this.getMediaType(signature2Buffer);

      // Ambil QR Code
      let qrCodeBuffer: Buffer;
      try {
        const { buffer } = await this.fileUploadService.downloadFile(participant.qrCodePath);
        qrCodeBuffer = buffer;
      } catch (err: any) {
        throw new Error('Gagal mengambil QR Code: ' + (err.message || err));
      }
      const qrCodeBase64 = qrCodeBuffer.toString('base64');

      // Format tanggal
      const formattedStartDate = this.formatDate(new Date(cot.startDate));
      const formattedEndDate = this.formatDate(new Date(cot.endDate));
      const formattedDateOfBirth = this.formatDate(new Date(participant.dateOfBirth));

      // Filter GSE Regulation dan Competencies
      const GSERegulation = capability.curriculumSyllabus.filter(
        (item) => item.type === 'Regulasi GSE',
      );
      const Competencies = capability.curriculumSyllabus.filter(
        (item) => item.type === 'Kompetensi',
      );

      // Render template
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
        qrCodeBase64: qrCodeBase64,
        GSERegulation: GSERegulation,
        Competencies: Competencies,
        totalDuration: capability.totalDuration,
        theoryScore: theoryScore,
        practiceScore: practiceScore,
      });

      // Generate PDF dengan Puppeteer
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
          '--disable-features=VizDisplayCompositor',
        ],
      };

      // Cari Chrome executable
      const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ];

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
        this.logger.log('Launching Puppeteer for certificate update...', puppeteerOptions);
        browser = await puppeteer.launch(puppeteerOptions);
      } catch (error) {
        this.logger.error('Failed to launch Puppeteer:', error.message);
        throw new HttpException(
          `Gagal menjalankan PDF generator: ${error.message}. Pastikan Chrome ter-install di sistem.`,
          500,
        );
      }

      let certificateBuffer: Buffer;
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        await page.setContent(certificate, {
          waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
          timeout: 30000,
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
            left: '0mm',
          },
        });

        certificateBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : Buffer.from(pdfResult);
        await browser.close();
      } catch (error) {
        if (browser) {
          await browser.close();
        }
        this.logger.error('Failed to generate PDF:', error.message);
        throw new HttpException(`Gagal generate PDF certificate: ${error.message}`, 500);
      }

      // Validasi PDF buffer
      if (!certificateBuffer || !Buffer.isBuffer(certificateBuffer) || certificateBuffer.length === 0) {
        throw new HttpException(
          'Gagal generate PDF certificate: Invalid buffer generated',
          500,
        );
      }

      // Verify PDF signature
      const pdfSignatureBytes = certificateBuffer.subarray(0, 5);
      const pdfSignature = String.fromCharCode(...pdfSignatureBytes);

      if (!pdfSignature.startsWith('%PDF')) {
        throw new HttpException(
          'Gagal generate PDF certificate: Invalid PDF format generated',
          500,
        );
      }

      // Hapus file lama dari storage
      if (oldCertificatePath) {
        try {
          await this.fileUploadService.deleteFile(oldCertificatePath);
          this.logger.log(`Deleted old certificate file: ${oldCertificatePath}`);
        } catch (err: any) {
          this.logger.warn(`Failed to delete old certificate file: ${oldCertificatePath}`, err.message);
          // Continue even if deletion fails
        }
      }

      // Upload file baru
      try {
        const safeCertificateNumber = certificateNumber.replace(/\//g, '_');
        const fileObj: Express.Multer.File = {
          fieldname: 'certificate',
          originalname: `${safeCertificateNumber}.pdf`,
          encoding: '7bit',
          mimetype: 'application/pdf',
          buffer: certificateBuffer,
          size: certificateBuffer.length,
          destination: '',
          filename: `certificate_${certificateNumber}.pdf`,
          path: '',
          stream: undefined,
        };

        const uploadPath = `certificates/${safeCertificateNumber}.pdf`
          .replace(/\\/g, '/')
          .replace(/\/+/g, '/')
          .replace(/^\//, '');

        newCertificatePath = await this.fileUploadService.uploadFile(fileObj, uploadPath);
        this.logger.log(`Uploaded new certificate file: ${newCertificatePath}`);
      } catch (err: any) {
        throw new HttpException(
          `Gagal upload certificate PDF file: ${err.message}`,
          500,
        );
      }
    }

    // Update data di database
    const updateData: any = {};
    if (updateCertificateRequest.theoryScore !== undefined) {
      updateData.theoryScore = updateCertificateRequest.theoryScore;
    }
    if (updateCertificateRequest.practiceScore !== undefined) {
      updateData.practiceScore = updateCertificateRequest.practiceScore;
    }
    if (updateCertificateRequest.certificateNumber !== undefined) {
      updateData.certificateNumber = updateCertificateRequest.certificateNumber;
    }
    if (updateCertificateRequest.expDate !== undefined) {
      updateData.expDate = updateCertificateRequest.expDate;
    }
    if (needsPdfRegeneration && newCertificatePath) {
      updateData.certificatePath = newCertificatePath;
    }

    await this.prismaService.certificate.update({
      where: {
        id: certificateId,
      },
      data: updateData,
    });

    return 'Sertifikat berhasil diperbarui';
  }

  async getCertificateFile(certificateId: string): Promise<string> {
    const certificate = await this.prismaService.certificate.findUnique({
      where: {
        id: certificateId,
      },
    });

    if (!certificate || !certificate.certificatePath) {
      throw new HttpException('File Sertifikat tidak ditemukan', 404);
    }

    // Gabungkan SUPABASE_STORAGE_PUBLIC_URL dengan certificatePath
    try {
      const publicUrl = this.fileUploadService.provider.getPublicUrl(certificate.certificatePath);
      return publicUrl;
    } catch (err: any) {
      throw new HttpException('Gagal mengambil URL Sertifikat: ' + (err.message || err), 500);
    }
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

  async listCertificates(
    request: ListRequest,
    user: CurrentUserRequest,
  ): Promise<{
    data: CertificateListResponse[];
    actions: ActionAccessRights;
    paging: Paging;
  }> {
    const whereClause: any = {};

    // Search query untuk capability name atau certificate number
    if (request.searchQuery) {
      whereClause.OR = [
        {
          cot: {
            capabilityCots: {
              some: {
                capability: {
                  trainingName: {
                    contains: request.searchQuery,
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        },
        {
          certificateNumber: {
            contains: request.searchQuery,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Hitung total untuk pagination
    const totalCertificates = await this.prismaService.certificate.count({
      where: whereClause,
    });

    // Pagination parameters
    const page = request.page || 1;
    const size = request.size || 10;
    const totalPage = Math.ceil(totalCertificates / size);

    // Sorting
    const allowedSortFields = ['capabilityName', 'expDate'];
    const sortBy = request.sortBy && allowedSortFields.includes(request.sortBy) 
      ? request.sortBy 
      : 'expDate';
    const sortOrder: 'asc' | 'desc' = request.sortOrder === 'desc' ? 'desc' : 'asc';

    let certificates: any[];
    let certificateList: CertificateListResponse[];

    if (sortBy === 'capabilityName') {
      // Untuk capabilityName, ambil semua data, transform, sort, lalu pagination manual
      const allCertificates = await this.prismaService.certificate.findMany({
        where: whereClause,
        include: {
          cot: {
            select: {
              id: true,
              capabilityCots: {
                include: {
                  capability: {
                    select: {
                      trainingName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Transform data ke response format
      certificateList = allCertificates.map((cert) => {
        const capability = cert.cot.capabilityCots[0]?.capability;
        return {
          id: cert.id,
          cotId: cert.cot.id,
          capabilityName: capability?.trainingName || 'Unknown Capability',
          expDate: cert.expDate,
        };
      });

      // Natural sort by capabilityName
      certificateList.sort((a, b) =>
        naturalSort(a.capabilityName || '', b.capabilityName || '', sortOrder),
      );

      // Pagination manual
      certificateList = certificateList.slice((page - 1) * size, page * size);
    } else {
      // Untuk expDate, gunakan orderBy di database dengan pagination
      certificates = await this.prismaService.certificate.findMany({
        where: whereClause,
        include: {
          cot: {
            select: {
              id: true,
              capabilityCots: {
                include: {
                  capability: {
                    select: {
                      trainingName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { expDate: sortOrder },
        skip: (page - 1) * size,
        take: size,
      });

      // Transform data ke response format
      certificateList = certificates.map((cert) => {
        const capability = cert.cot.capabilityCots[0]?.capability;
        return {
          id: cert.id,
          cotId: cert.cot.id,
          capabilityName: capability?.trainingName || 'Unknown Capability',
          expDate: cert.expDate,
        };
      });
    }

    const userRole = user.role.name.toLowerCase();
    const actions = this.validateActions(userRole);

    return {
      data: certificateList,
      actions: actions,
      paging: {
        currentPage: page,
        totalPage: totalPage,
        size: size,
      },
    };
  }

  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canView: true, canEdit: true, canDelete: true },
      supervisor: { canView: true },
      lcu: { canView: true },
      user: { canView: true },
    };

    return this.coreHelper.validateActions(userRole, accessMap);
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
