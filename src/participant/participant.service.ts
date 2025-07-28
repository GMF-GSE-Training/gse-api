import { HttpException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/service/prisma.service";
import { CreateParticipantRequest, ParticipantResponse, UpdateParticipantRequest } from "../model/participant.model";
import { ValidationService } from "../common/service/validation.service";
import { ParticipantValidation } from "./participant.validation";
import * as puppeteer from 'puppeteer';
import { CurrentUserRequest } from "src/model/auth.model";
import { Participant } from "@prisma/client";
import { ActionAccessRights, ListRequest, Paging } from "src/model/web.model";
import { ConfigService } from "@nestjs/config";
import { CoreHelper } from "src/common/helpers/core.helper";
import { PDFDocument, PDFImage } from "pdf-lib";
import { join } from "path";
import * as ejs from 'ejs';
import { UrlHelper } from '../common/helpers/url.helper';
import { QrCodeService } from "../qrcode/qrcode.service";
import * as fs from 'fs';
import { getFileBufferFromMinio } from '../common/helpers/minio.helper';
import { FileUploadService } from '../file-upload/file-upload.service';
import * as archiver from 'archiver';
import { naturalSort } from '../common/helpers/natural-sort';

@Injectable()
export class ParticipantService {
    private readonly logger = new Logger(ParticipantService.name);
    constructor(
        private readonly prismaService: PrismaService,
        private readonly validationService: ValidationService,
        private readonly configService: ConfigService,
        private readonly coreHelper: CoreHelper,
        private readonly urlHelper: UrlHelper,
        private readonly qrCodeService: QrCodeService,
        private readonly fileUploadService: FileUploadService,
    ) {}

    async uploadParticipantFile(buffer: Buffer): Promise<void> {
        const mediaType = this.coreHelper.getMediaType(buffer);
        this.logger.log(`File type detected: ${mediaType}`);
    }

    async createParticipant(data: CreateParticipantRequest, user: CurrentUserRequest): Promise<ParticipantResponse> {
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                data[key] = this.coreHelper.transformEmptyToNull(data[key]);
            }
        }
    
        const createRequest = this.validationService.validate(ParticipantValidation.CREATE, data);
    
        const userRole = user.role.name.toLowerCase();
    
        if(userRole === 'lcu') {
            if(!createRequest.dinas) {
                throw new HttpException('Dinas tidak boleh kosong', 400);
            } else if(user.dinas != createRequest.dinas) {
                throw new HttpException('LCU hanya bisa menambahkan pengguna dengan role user dengan dinas yang sama', 400);
            }
        }
    
        if(createRequest.nik) {
            await this.coreHelper.ensureUniqueFields('participant', [
                { field: 'nik', value: createRequest.nik, message: 'NIK sudah ada di data peserta' }
            ]);
        }
    
        await this.coreHelper.ensureUniqueFields('participant', [
            { field: 'idNumber', value: createRequest.idNumber, message: 'No Pegawai sudah ada di data peserta' },
            { field: 'email', value: createRequest.email, message: 'Email sudah ada di data peserta' }
        ]);
    
        if(createRequest.company) {
            createRequest.gmfNonGmf = createRequest.company.toLowerCase().includes('gmf') ? 'GMF' : 'Non GMF';
        }
    
        createRequest.dinas ? createRequest.dinas.toUpperCase() : createRequest.dinas;
        createRequest.bidang ? createRequest.bidang.toUpperCase() : createRequest.bidang;

        // PATCH: Upload file jika buffer ada, assign path
        const fileFields = [
            { key: 'simA', fileNameKey: 'simAFileName', pathKey: 'simAPath' },
            { key: 'simB', fileNameKey: 'simBFileName', pathKey: 'simBPath' },
            { key: 'ktp', fileNameKey: 'ktpFileName', pathKey: 'ktpPath' },
            { key: 'foto', fileNameKey: 'fotoFileName', pathKey: 'fotoPath' },
            { key: 'suratSehatButaWarna', fileNameKey: 'suratSehatButaWarnaFileName', pathKey: 'suratSehatButaWarnaPath' },
            { key: 'suratBebasNarkoba', fileNameKey: 'suratBebasNarkobaFileName', pathKey: 'suratBebasNarkobaPath' },
        ];
        for (const field of fileFields) {
            if (createRequest[field.key]) {
                try {
                    this.logger.log(`Uploading file ${field.key} for participant...`);
                    const fileObj = {
                        buffer: createRequest[field.key],
                        originalname: createRequest[field.fileNameKey] || `${field.key}.png`,
                        mimetype: 'application/octet-stream', // Default, bisa diimprove jika ada info
                        size: createRequest[field.key].length,
                    };
                    // Simulasi Express.Multer.File
                    const path = await this.fileUploadService.uploadFile(fileObj as any, fileObj.originalname);
                    createRequest[field.pathKey] = path;
                    this.logger.log(`File ${field.key} uploaded, path: ${path}`);
                } catch (err) {
                    this.logger.error(`Gagal upload file ${field.key}: ${err.message}`);
                    throw new HttpException(`Gagal upload file ${field.key}: ${err.message}`, 500);
                }
            }
        }

        const participant = await this.prismaService.participant.create({
            data: {
                idNumber: createRequest.idNumber,
                name: createRequest.name,
                nik: createRequest.nik,
                dinas: createRequest.dinas,
                bidang: createRequest.bidang,
                company: createRequest.company,
                email: createRequest.email,
                phoneNumber: createRequest.phoneNumber,
                nationality: createRequest.nationality,
                placeOfBirth: createRequest.placeOfBirth,
                dateOfBirth: createRequest.dateOfBirth,
                simAPath: createRequest.simAPath,
                simAFileName: createRequest.simAFileName,
                simBPath: createRequest.simBPath,
                simBFileName: createRequest.simBFileName,
                ktpPath: createRequest.ktpPath,
                ktpFileName: createRequest.ktpFileName,
                fotoPath: createRequest.fotoPath,
                fotoFileName: createRequest.fotoFileName,
                suratSehatButaWarnaPath: createRequest.suratSehatButaWarnaPath,
                suratSehatButaWarnaFileName: createRequest.suratSehatButaWarnaFileName,
                tglKeluarSuratSehatButaWarna: createRequest.tglKeluarSuratSehatButaWarna,
                suratBebasNarkobaPath: createRequest.suratBebasNarkobaPath,
                suratBebasNarkobaFileName: createRequest.suratBebasNarkobaFileName,
                tglKeluarSuratBebasNarkoba: createRequest.tglKeluarSuratBebasNarkoba,
                gmfNonGmf: createRequest.gmfNonGmf,
            },
        });
    
        // Hasilkan QR code perdana menggunakan service baru
        await this.qrCodeService.getOrRegenerateQrCodeForParticipant(participant.id);
    
        const result = await this.findOneParticipant(participant.id);
        return this.toParticipantResponse(result);
    }

    async getQrCode(participantId: string): Promise<Buffer> {
        return this.qrCodeService.getOrRegenerateQrCodeForParticipant(
          participantId,
        );
    }

    async streamFile(participantId: string, fileName: string, user: CurrentUserRequest): Promise<Buffer> {
        const participant = await this.findOneParticipant(participantId);
    
        if(!participant) {
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
    
        const userRole = user.role.name.toLowerCase();
    
        if(userRole === 'user') {
            if(participant.nik !== user.nik) {
                throw new HttpException('Akses terlarang, pengguna tidak bisa mengakses data pengguna lain', 403);
            }
        }
    
        if(userRole === 'lcu') {
            this.validateDinasForLcuRequest(participant.dinas, user.dinas);
        }
    
        const pathField = fileName + 'Path';
        if (fileName === 'foto' && !participant.fotoPath) {
            this.logger.debug(`Peserta ${participantId} tidak memiliki foto, menyajikan gambar default.`);
            try {
                const defaultImagePath = join(__dirname, '..', '..', 'public', 'assets', 'images', 'blank-profile-picture.png');
                return fs.readFileSync(defaultImagePath);
            } catch (error) {
                this.logger.error('Gagal membaca file foto default', error.stack);
                throw new HttpException('File default tidak ditemukan', 500);
            }
        }

        // Ambil file dari storage dinamis
        let fileBuffer: Buffer;
        try {
          const { buffer } = await this.fileUploadService.downloadFile(participant[pathField]);
          fileBuffer = buffer;
        } catch (err) {
          if (err.status === 404) {
            throw new HttpException(`File ${fileName} tidak ditemukan untuk peserta ini.`, 404);
          }
          this.logger.error(`Gagal mengambil file ${fileName}: ${err.message}`);
          throw new HttpException(`Gagal mengambil file ${fileName}: ${err.message}`, 500);
        }

        if (!fileBuffer) {
            throw new HttpException(`File ${fileName} tidak ditemukan untuk peserta ini.`, 404);
        }

        return fileBuffer;
    }

    async getParticipant(participantId: string, user: CurrentUserRequest): Promise<ParticipantResponse> {
        const participant = await this.findOneParticipant(participantId);
    
        if(!participant) {
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
    
        const userRole = user.role.name.toLowerCase();
    
        if(userRole === 'lcu') {
            this.validateDinasForLcuRequest(participant.dinas, user.dinas);
        }
    
        return this.toParticipantResponse(participant);
    }

    async downloadIdCard(participantId: string): Promise<{ pdfBuffer: Buffer; participantName: string }> {
        this.logger.debug(`Mengunduh ID Card untuk participant ID: ${participantId}`);

        // Ambil data peserta dan pastikan QR code terbaru
        const qrCodeBuffer = await this.qrCodeService.getOrRegenerateQrCodeForParticipant(participantId);
        const participant = await this.findOneParticipant(participantId);
        
        const requiredFields = {
            foto: participant.fotoPath,
            company: participant.company,
            nationality: participant.nationality,
            qrCode: qrCodeBuffer,
        };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            this.logger.warn(`Data ID Card tidak lengkap: ${missingFields.join(', ')}`);
            throw new HttpException('ID Card tidak bisa diunduh, lengkapi data terlebih dahulu', 400);
        }

        // Konfigurasi URL dan konversi data
        const backendUrl = this.urlHelper.getBaseUrl('backend');
        const gmfLogoUrl = `${backendUrl}/assets/images/Logo_GMF_Aero_Asia.png`;
        // Ambil foto dari storage dinamis
        const storageType = process.env.STORAGE_TYPE || 'minio';
        let photoBuffer: Buffer;
        if (storageType === 'supabase') {
          const { buffer } = await this.fileUploadService.downloadFile(participant.fotoPath);
          photoBuffer = buffer;
        } else {
          photoBuffer = await getFileBufferFromMinio(participant.fotoPath);
        }
        const photoBase64 = photoBuffer.toString('base64');
        const qrCodeBase64 = Buffer.from(qrCodeBuffer).toString('base64');
        const photoType = this.coreHelper.getMediaType(photoBuffer);
        const qrCodeType = this.coreHelper.getMediaType(qrCodeBuffer);

        // Render template EJS
        const templatePath = join(__dirname, '..', 'templates', 'id-card', 'id-card.ejs');
        let idCardHtml: string;
        try {
            idCardHtml = await ejs.renderFile(templatePath, {
                gmfLogoUrl,
                photoBase64,
                qrCodeBase64,
                photoType,
                qrCodeType,
                name: participant.name,
                company: participant.company,
                idNumber: participant.idNumber,
                nationality: participant.nationality,
            });
        } catch (error) {
            this.logger.error('Gagal merender template EJS untuk ID Card', error.stack);
            throw new HttpException('Gagal menghasilkan ID Card', 500);
        }

        // Generate PDF dengan Puppeteer
        try {
            const browser = await puppeteer.launch({
                headless: true, // Kompatibel dengan semua versi
                args: ['--no-sandbox', '--disable-setuid-sandbox'], // Hindari masalah izin
            });
            const page = await browser.newPage();
            await page.setContent(idCardHtml, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({ format: 'A4' });
            await browser.close();
            this.logger.debug(`Berhasil menghasilkan PDF ID Card untuk participant ID: ${participantId}`);
            return { pdfBuffer: Buffer.from(pdfBuffer), participantName: participant.name };
        } catch (error) {
            this.logger.error('Gagal menghasilkan PDF ID Card dengan Puppeteer', {
                message: error.message,
                stack: error.stack,
            });
            throw new HttpException('Gagal menghasilkan ID Card PDF', 500);
        }
    }

    async downloadDocument(participantId: string): Promise<{ pdfBuffer: Buffer; participantName: string }> {
        this.logger.debug(`Mengunduh dokumen untuk participant ID: ${participantId}`);

        // Ambil data peserta
        const participant = await this.findOneParticipant(participantId);
        const requiredFields = {
            simA: participant.simAPath,
            ktp: participant.ktpPath,
            suratSehatButaWarna: participant.suratSehatButaWarnaPath,
            suratBebasNarkoba: participant.suratBebasNarkobaPath,
        };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            this.logger.warn(`Dokumen tidak lengkap: ${missingFields.join(', ')}`);
            throw new HttpException('Dokumen belum lengkap, lengkapi data terlebih dahulu', 400);
        }

        // Buat dokumen PDF baru
        const pdfDoc = await PDFDocument.create();

        // Fungsi bantu untuk menambahkan file ke PDF
        const addFileToPdf = async (fileBuffer: Buffer, fileName: string) => {
            const mimeType = this.coreHelper.getMediaType(fileBuffer);
            try {
                if (mimeType === 'application/pdf') {
                    const existingPdf = await PDFDocument.load(fileBuffer);
                    const copiedPages = await pdfDoc.copyPages(existingPdf, existingPdf.getPageIndices());
                    copiedPages.forEach((page) => pdfDoc.addPage(page));
                } else if (mimeType.startsWith('image/')) {
                    const page = pdfDoc.addPage();
                    const { width, height } = page.getSize();
                    let embeddedImage: PDFImage;

                    if (mimeType === 'image/jpeg') {
                        embeddedImage = await pdfDoc.embedJpg(fileBuffer);
                    } else if (mimeType === 'image/png') {
                        embeddedImage = await pdfDoc.embedPng(fileBuffer);
                    } else {
                        this.logger.warn(`Format file '${fileName}' tidak didukung: ${mimeType}`);
                        throw new Error(`Unsupported format`);
                    }

                    const scale = Math.min(width / embeddedImage.width, height / embeddedImage.height);
                    const scaledWidth = embeddedImage.width * scale;
                    const scaledHeight = embeddedImage.height * scale;

                    page.drawImage(embeddedImage, {
                        x: (width - scaledWidth) / 2,
                        y: (height - scaledHeight) / 2,
                        width: scaledWidth,
                        height: scaledHeight,
                    });
                } else {
                    this.logger.warn(`Tipe file '${fileName}' tidak didukung: ${mimeType}`);
                    throw new Error(`Unsupported file type`);
                }
            } catch (error) {
                this.logger.error(`Gagal memproses dokumen '${fileName}'`, error.stack);
                throw new HttpException(`Gagal memproses dokumen ${fileName}`, 500);
            }
        };

        // Tambahkan dokumen ke PDF
        let simABuffer: Buffer, ktpBuffer: Buffer, suratSehatButaWarnaBuffer: Buffer, suratBebasNarkobaBuffer: Buffer;
        try {
          simABuffer = (await this.fileUploadService.downloadFile(participant.simAPath)).buffer;
        } catch (err: any) { simABuffer = undefined; }
        try {
          ktpBuffer = (await this.fileUploadService.downloadFile(participant.ktpPath)).buffer;
        } catch (err: any) { ktpBuffer = undefined; }
        try {
          suratSehatButaWarnaBuffer = (await this.fileUploadService.downloadFile(participant.suratSehatButaWarnaPath)).buffer;
        } catch (err: any) { suratSehatButaWarnaBuffer = undefined; }
        try {
          suratBebasNarkobaBuffer = (await this.fileUploadService.downloadFile(participant.suratBebasNarkobaPath)).buffer;
        } catch (err: any) { suratBebasNarkobaBuffer = undefined; }
        if (simABuffer) await addFileToPdf(simABuffer, 'SIM A');
        if (ktpBuffer) await addFileToPdf(ktpBuffer, 'KTP');
        if (suratSehatButaWarnaBuffer) await addFileToPdf(suratSehatButaWarnaBuffer, 'Surat Sehat Buta Warna');
        if (suratBebasNarkobaBuffer) await addFileToPdf(suratBebasNarkobaBuffer, 'Surat Bebas Narkoba');

        // Simpan dan kembalikan PDF
        const pdfBytes = await pdfDoc.save();
        this.logger.debug(`Berhasil menghasilkan PDF dokumen untuk participant ID: ${participantId}`);
        return { pdfBuffer: Buffer.from(pdfBytes), participantName: participant.name };
    }

    async getIdCard(participantId: string): Promise<string> {
        this.logger.debug(`Rendering ID Card HTML untuk participant ID: ${participantId}`);

        // Validasi input
        if (!participantId || participantId.trim() === '') {
            this.logger.warn('Participant ID kosong atau tidak valid');
            throw new HttpException('ID peserta tidak valid', 400);
        }

        // Pastikan QR code terbaru
        const qrCodeBuffer = await this.qrCodeService.getOrRegenerateQrCodeForParticipant(participantId);
        const participant = await this.findOneParticipant(participantId);
        
        const requiredFields = {
            foto: participant.fotoPath,
            company: participant.company,
            nationality: participant.nationality,
            qrCode: qrCodeBuffer,
        };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            this.logger.warn(`Data ID Card tidak lengkap: ${missingFields.join(', ')}`);
            throw new HttpException('ID Card tidak bisa dilihat, lengkapi data terlebih dahulu', 400);
        }

        // Konversi data ke base64
        const { buffer: photoBuffer } = await this.fileUploadService.downloadFile(participant.fotoPath);
        const photoBase64 = photoBuffer.toString('base64');
        const qrCodeBase64 = qrCodeBuffer.toString('base64');
        const photoType = this.coreHelper.getMediaType(photoBuffer);
        const qrCodeType = this.coreHelper.getMediaType(qrCodeBuffer);

        // Konfigurasi URL
        const backendUrl = this.urlHelper.getBaseUrl('backend');
        const gmfLogoUrl = `${backendUrl}/assets/images/Logo_GMF_Aero_Asia.png`;

        // Render template EJS
        const templatePath = join(__dirname, '..', 'templates', 'id-card', 'id-card.ejs');
        try {
            const idCard = await ejs.renderFile(templatePath, {
                gmfLogoUrl,
                photoBase64,
                qrCodeBase64,
                photoType,
                qrCodeType,
                name: participant.name,
                company: participant.company,
                idNumber: participant.idNumber,
                nationality: participant.nationality,
            });
            this.logger.debug(`Berhasil merender ID Card HTML untuk participant ID: ${participantId}`);
            return idCard;
        } catch (error) {
            this.logger.error('Gagal merender template EJS untuk ID Card', error.stack);
            throw new HttpException('Gagal merender tampilan ID Card', 500);
        }
    }

    async updateParticipant(participantId: string, req: UpdateParticipantRequest, user: CurrentUserRequest): Promise<string> {
        for (const key in req) {
            if (req.hasOwnProperty(key)) {
                req[key] = this.coreHelper.transformEmptyToNull(req[key]);
            }
        }
    
        req.gmfNonGmf = req.company.toLowerCase().includes('gmf') || req.company.toLowerCase().includes('garuda maintenance facility') ? 'GMF' : 'Non GMF';
        const updateRequest = this.validationService.validate(ParticipantValidation.UPDATE, req);
    
        const participant = await this.prismaService.participant.findUnique({
            where: {
                id: participantId,
            }
        });
    
        if(!participant) {
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
    
        const userRole = user.role.name.toLowerCase();
    
        if(userRole === 'user') {
            if(user.participantId !== participantId) {
                throw new HttpException('Anda tidak bisa memperbarui data participant lain', 403);
            }
        }
    
        if(userRole !== 'super admin' && updateRequest.email) {
            throw new HttpException('Anda tidak bisa mengubah email participant', 400);
        }
    
        if(updateRequest.email) {
            await this.coreHelper.ensureUniqueFields('participant', [
                { field: 'email', value: updateRequest.email, message: 'Email sudah ada di data peserta', }
            ], participantId);
        }
    
        await this.coreHelper.ensureUniqueFields('participant', [
            { field: 'idNumber', value: updateRequest.idNumber, message: 'No Pegawai sudah ada di data peserta' },
        ], participantId);
        
        this.logger.debug('UpdateParticipant request:', req);

        // PATCH: Upload file jika buffer ada, assign path
        const fileFields = [
            { key: 'simA', fileNameKey: 'simAFileName', pathKey: 'simAPath' },
            { key: 'simB', fileNameKey: 'simBFileName', pathKey: 'simBPath' },
            { key: 'ktp', fileNameKey: 'ktpFileName', pathKey: 'ktpPath' },
            { key: 'foto', fileNameKey: 'fotoFileName', pathKey: 'fotoPath' },
            { key: 'suratSehatButaWarna', fileNameKey: 'suratSehatButaWarnaFileName', pathKey: 'suratSehatButaWarnaPath' },
            { key: 'suratBebasNarkoba', fileNameKey: 'suratBebasNarkobaFileName', pathKey: 'suratBebasNarkobaPath' },
        ];
        for (const field of fileFields) {
            if (updateRequest[field.key]) {
                try {
                    this.logger.log(`Uploading file ${field.key} for participant (update)...`);
                    const fileObj = {
                        buffer: updateRequest[field.key],
                        originalname: updateRequest[field.fileNameKey] || `${field.key}.png`,
                        mimetype: 'application/octet-stream',
                        size: updateRequest[field.key].length,
                    };
                    const path = await this.fileUploadService.uploadFile(fileObj as any, fileObj.originalname);
                    updateRequest[field.pathKey] = path;
                    this.logger.log(`File ${field.key} uploaded (update), path: ${path}`);
                } catch (err) {
                    this.logger.error(`Gagal upload file ${field.key} (update): ${err.message}`);
                    throw new HttpException(`Gagal upload file ${field.key}: ${err.message}`, 500);
                }
            }
        }

        // Hanya field yang valid di schema yang di-assign ke updateData
        const updateData: any = {
            idNumber: req.idNumber,
            name: req.name,
            nik: req.nik,
            dinas: req.dinas,
            bidang: req.bidang,
            company: req.company,
            phoneNumber: req.phoneNumber,
            nationality: req.nationality,
            placeOfBirth: req.placeOfBirth,
            dateOfBirth: req.dateOfBirth ? new Date(req.dateOfBirth) : undefined,
            simAFileName: req.simAFileName,
            simAPath: updateRequest.simAPath,
            simBFileName: req.simBFileName,
            simBPath: updateRequest.simBPath,
            ktpFileName: req.ktpFileName,
            ktpPath: updateRequest.ktpPath,
            fotoFileName: req.fotoFileName,
            fotoPath: updateRequest.fotoPath,
            suratSehatButaWarnaFileName: req.suratSehatButaWarnaFileName,
            suratSehatButaWarnaPath: updateRequest.suratSehatButaWarnaPath,
            tglKeluarSuratSehatButaWarna: req.tglKeluarSuratSehatButaWarna ? new Date(req.tglKeluarSuratSehatButaWarna) : undefined,
            suratBebasNarkobaFileName: req.suratBebasNarkobaFileName,
            suratBebasNarkobaPath: updateRequest.suratBebasNarkobaPath,
            tglKeluarSuratBebasNarkoba: req.tglKeluarSuratBebasNarkoba ? new Date(req.tglKeluarSuratBebasNarkoba) : undefined,
            gmfNonGmf: req.gmfNonGmf,
            // tambahkan field lain yang memang ada di schema jika perlu
        };

        // Hapus field undefined/null agar payload bersih
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        this.logger.debug('Payload update participant ke Prisma:', updateData);

        const result = await this.prismaService.participant.update({
            where: { id: participantId },
            data: updateData,
        });

        this.logger.debug('UpdateParticipant result:', result);

        return 'Participant berhasil diupdate';
    }

    async deleteParticipant(participantId: string, user: CurrentUserRequest): Promise<string> {
        this.logger.log(`Memulai penghapusan participant dengan ID: ${participantId} oleh user: ${user.email}`);
        const participant = await this.findOneParticipant(participantId);

        if (!participant) {
            this.logger.warn(`Participant dengan ID ${participantId} tidak ditemukan.`);
            throw new HttpException('Peserta tidak ditemukan', 404);
        }

        if (user.dinas || user.dinas !== null) {
            this.validateDinasForLcuRequest(participant.dinas, user.dinas);
            this.logger.debug(`Validasi dinas untuk LCU berhasil untuk participant ${participantId}.`);
        }

        try {
            await this.prismaService.$transaction(async (prisma) => {
                this.logger.debug(`Memulai transaksi penghapusan untuk participant ${participantId}.`);

                // Hapus user terkait (jika ada)
                const findUser = await prisma.user.findFirst({
                    where: {
                        participantId: participant.id,
                    },
                });

                if (findUser) {
                    this.logger.debug(`Participant ${participantId} memiliki user terkait dengan ID: ${findUser.id}. Menghapus user terkait.`);
                    const deletedUser = await prisma.user.delete({
                        where: {
                            id: findUser.id,
                        },
                    });
                    this.logger.debug(`User ${findUser.id} berhasil dihapus. Hasil: ${JSON.stringify(deletedUser)}`);
                }

                // Hapus data terkait di tabel participantsCOT
                this.logger.debug(`Menghapus entri participantsCOT untuk participant ${participantId}.`);
                const deletedParticipantsCot = await prisma.participantsCOT.deleteMany({
                    where: {
                        participantId: participantId,
                    },
                });
                this.logger.debug(`${deletedParticipantsCot.count} entri participantsCOT berhasil dihapus untuk participant ${participantId}.`);

                // Hapus data peserta
                this.logger.debug(`Menghapus data participant dengan ID: ${participantId}.`);
                const deletedParticipantData = await prisma.participant.delete({
                    where: {
                        id: participantId,
                    },
                });
                this.logger.debug(`Participant ${participantId} berhasil dihapus. Hasil: ${JSON.stringify(deletedParticipantData)}`);
            });
            this.logger.log(`Penghapusan participant ${participantId} dan data terkait berhasil.`);
            return 'Berhasil menghapus participant';
        } catch (error) {
            this.logger.error(`Gagal menghapus participant ${participantId} atau data terkait: ${error.message}`, error.stack);
            throw new HttpException('Gagal menghapus participant atau data terkait', 500);
        }
    }

    async listParticipants(request: ListRequest, user: CurrentUserRequest):Promise<{ data: ParticipantResponse[], actions: ActionAccessRights, paging: Paging }> {
        const userRole = user.role.name.toLowerCase();
    
        const participantSelectFields = {
            id: true,
            idNumber: true,
            name: true,
            nik: true,
            dinas: true,
            bidang: true,
            company: true,
            email: true,
            phoneNumber: true,
            nationality: true,
            placeOfBirth: true,
            dateOfBirth: true,
            simAPath: true,
            simAFileName: true,
            simBPath: true,
            simBFileName: true,
            ktpPath: true,
            ktpFileName: true,
            fotoPath: true,
            fotoFileName: true,
            suratSehatButaWarnaPath: true,
            suratSehatButaWarnaFileName: true,
            tglKeluarSuratSehatButaWarna: true,
            suratBebasNarkobaPath: true,
            suratBebasNarkobaFileName: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
        }
    
        let whereClause: any = {};
    
        if (userRole === 'lcu') {
            whereClause = {
                dinas: {
                    equals: user.dinas,
                    mode: "insensitive",
                }
            };
        }
        
        if (request.searchQuery) {
            const searchQuery = request.searchQuery;
            if (userRole === 'super admin' || userRole === 'supervisor') {
                whereClause.OR = [
                    { idNumber: { contains: searchQuery, mode: 'insensitive' } },
                    { name: { contains: searchQuery, mode: 'insensitive' } },
                    { email: { contains: searchQuery, mode: 'insensitive' } },
                    { dinas: { contains: searchQuery, mode: 'insensitive' } },
                    { bidang: { contains: searchQuery, mode: 'insensitive' } },
                    { company: { contains: searchQuery, mode: 'insensitive' } },
                ];
            } else {
                whereClause.OR = [
                    { idNumber: { contains: searchQuery, mode: 'insensitive' } },
                    { name: { contains: searchQuery, mode: 'insensitive' } },
                    { email: { contains: searchQuery, mode: 'insensitive' } },
                    { bidang: { contains: searchQuery, mode: 'insensitive' } },
                ];
            }
        }
    
        // Hitung total untuk pagination
        const totalUsers = await this.prismaService.participant.count({
            where: whereClause,
        });

        // Pagination parameters
        const page = request.page || 1;
        const size = request.size || 10;
        const totalPage = Math.ceil(totalUsers / size);

        // Sorting universal
        const allowedSortFields = [
            'id', 'idNumber', 'name', 'nik', 'dinas', 'bidang', 'company', 'email', 'phoneNumber', 'nationality', 'placeOfBirth', 'dateOfBirth',
            'tglKeluarSuratSehatButaWarna', 'tglKeluarSuratBebasNarkoba', 'expSuratSehatButaWarna', 'expSuratBebasNarkoba'
        ];
        const naturalSortFields = ['idNumber', 'name', 'company', 'dinas', 'bidang', 'email'];
        const dateFields = ['dateOfBirth', 'tglKeluarSuratSehatButaWarna', 'tglKeluarSuratBebasNarkoba'];
        const computedFields = ['expSuratSehatButaWarna', 'expSuratBebasNarkoba'];
        const dbSortFields = ['id', 'nik', 'phoneNumber', 'nationality', 'placeOfBirth', 'dateOfBirth', 'tglKeluarSuratSehatButaWarna', 'tglKeluarSuratBebasNarkoba'];
        
        let sortBy = request.sortBy && allowedSortFields.includes(request.sortBy) ? request.sortBy : 'idNumber';
        let sortOrder: 'asc' | 'desc' = request.sortOrder === 'desc' ? 'desc' : 'asc';

        // Optimasi: Strategi berbeda berdasarkan field type
        let participants: any[];
        
        if (naturalSortFields.includes(sortBy)) {
          // Natural sort global: ambil seluruh data, sort, lalu pagination manual
          const allParticipants = await this.prismaService.participant.findMany({
            where: whereClause,
            select: participantSelectFields,
          });
          allParticipants.sort((a, b) => naturalSort(a[sortBy] || '', b[sortBy] || '', sortOrder));
          participants = allParticipants.slice((page - 1) * size, page * size);
        } else if (dateFields.includes(sortBy)) {
          // Date sort global: ambil seluruh data, sort berdasarkan tanggal, lalu pagination manual
          const allParticipants = await this.prismaService.participant.findMany({
            where: whereClause,
            select: participantSelectFields,
          });
          allParticipants.sort((a, b) => {
            const aDate = a[sortBy] ? new Date(a[sortBy]) : null;
            const bDate = b[sortBy] ? new Date(b[sortBy]) : null;
            
            // Handle null values - put them at the end
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            
            const comparison = aDate.getTime() - bDate.getTime();
            return sortOrder === 'asc' ? comparison : -comparison;
          });
          participants = allParticipants.slice((page - 1) * size, page * size);
        } else if (computedFields.includes(sortBy)) {
          // Computed field sorting: calculate expiry dates and sort
          const allParticipants = await this.prismaService.participant.findMany({
            where: whereClause,
            select: participantSelectFields,
          });
          
          // Add computed fields to each participant
          const participantsWithComputed = allParticipants.map(p => {
            const expSuratSehatButaWarna = p.tglKeluarSuratSehatButaWarna 
              ? new Date(new Date(p.tglKeluarSuratSehatButaWarna).setMonth(new Date(p.tglKeluarSuratSehatButaWarna).getMonth() + 6))
              : null;
            const expSuratBebasNarkoba = p.tglKeluarSuratBebasNarkoba
              ? new Date(new Date(p.tglKeluarSuratBebasNarkoba).setMonth(new Date(p.tglKeluarSuratBebasNarkoba).getMonth() + 6))
              : null;
            
            return {
              ...p,
              expSuratSehatButaWarna,
              expSuratBebasNarkoba
            };
          });
          
          // Sort by computed field
          participantsWithComputed.sort((a, b) => {
            const aDate = a[sortBy];
            const bDate = b[sortBy];
            
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            
            const comparison = aDate.getTime() - bDate.getTime();
            return sortOrder === 'asc' ? comparison : -comparison;
          });
          
          participants = participantsWithComputed.slice((page - 1) * size, page * size);
        } else if (dbSortFields.includes(sortBy)) {
          // Database sorting
          let orderBy: any;
          if (sortBy !== 'id') {
            orderBy = [
              { [sortBy]: sortOrder },
              { id: 'asc' }
            ];
          } else {
            orderBy = { id: sortOrder };
          }
          participants = await this.prismaService.participant.findMany({
            where: whereClause,
            select: participantSelectFields,
            skip: (page - 1) * size,
            take: size,
            orderBy,
          });
        } else {
          // Fallback: natural sort
          const allParticipants = await this.prismaService.participant.findMany({
            where: whereClause,
            select: participantSelectFields,
          });
          allParticipants.sort((a, b) => naturalSort(a[sortBy] || '', b[sortBy] || '', sortOrder));
          participants = allParticipants.slice((page - 1) * size, page * size);
        }
    
        const accessRights = this.validateActions(userRole);
    
        return {
            data: participants.map(participant => this.toParticipantResponse(participant)),
            actions: accessRights,
            paging: {
                currentPage: page,
                totalPage: totalPage,
                size: size,
            },
        };
    }

    toParticipantResponse(participant: any): ParticipantResponse {
        return {
            id: participant.id,
            idNumber: participant.idNumber,
            name: participant.name,
            nik: participant.nik,
            dinas: participant.dinas,
            bidang: participant.bidang,
            company: participant.company,
            email: participant.email,
            phoneNumber: participant.phoneNumber,
            nationality: participant.nationality,
            placeOfBirth: participant.placeOfBirth,
            dateOfBirth: participant.dateOfBirth,
            simAPath: participant.simAPath,
            simAFileName: participant.simAFileName,
            simBPath: participant.simBPath,
            simBFileName: participant.simBFileName,
            ktpPath: participant.ktpPath,
            ktpFileName: participant.ktpFileName,
            fotoPath: participant.fotoPath,
            fotoFileName: participant.fotoFileName,
            suratSehatButaWarnaPath: participant.suratSehatButaWarnaPath,
            suratSehatButaWarnaFileName: participant.suratSehatButaWarnaFileName,
            tglKeluarSuratSehatButaWarna: participant.tglKeluarSuratSehatButaWarna,
            tglKeluarSuratBebasNarkoba: participant.tglKeluarSuratBebasNarkoba,
            gmfNonGmf: participant.gmfNonGmf,
        };
    }

    private async findOneParticipant(participantId: string): Promise<Participant> {
        const participant = await this.prismaService.participant.findUnique({
            where: { id: participantId },
        });
        if (!participant) {
            this.logger.warn(`Participant not found for ID: ${participantId}`);
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
        return participant;
    }

    private validateDinasForLcuRequest(participantDinas: string, lcuDinas: string) {
        if(participantDinas != lcuDinas) {
            throw new HttpException('LCU hanya bisa menambahkan, melihat, dan menghapus data peserta dengan dinas yang sama', 403);
        }
    }

    private validateActions(userRole: string): ActionAccessRights {
        const accessMap = {
            'super admin': { canEdit: true, canDelete: true, canView: true, },
            'supervisor': { canEdit: false, canDelete: false, canView: true, },
            'lcu': { canEdit: true, canDelete: true, canView: true, },
        };
        
        return this.coreHelper.validateActions(userRole, accessMap);
    }

    // Tambahan helper untuk ambil participant tanpa validasi user/role
    async getParticipantRaw(participantId: string): Promise<Participant> {
        return this.findOneParticipant(participantId);
    }

    // Fungsi baru: Download semua file peserta sebagai ZIP
    async downloadAllFilesAsZip(participantId: string, res: any): Promise<void> {
        const participant = await this.findOneParticipant(participantId);
        const archive = archiver('zip', { zlib: { level: 9 } });
        let fileCount = 0;

        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="AllFiles_${participant.name || 'Participant'}_${participantId}.zip"`,
        });

        archive.pipe(res);

        // Daftar file yang ingin di-zip
        const files = [
            { path: participant.ktpPath, name: participant.ktpFileName || 'KTP.png' },
            { path: participant.simAPath, name: participant.simAFileName || 'SIM_A.png' },
            { path: participant.simBPath, name: participant.simBFileName || 'SIM_B.png' },
            { path: participant.fotoPath, name: participant.fotoFileName || 'Foto.png' },
            { path: participant.suratSehatButaWarnaPath, name: participant.suratSehatButaWarnaFileName || 'Surat_Sehat_Buta_Warna.png' },
            { path: participant.suratBebasNarkobaPath, name: participant.suratBebasNarkobaFileName || 'Surat_Bebas_Narkoba.png' },
        ];

        for (const file of files) {
            if (file.path) {
                try {
                    // Ambil buffer dari storage dinamis (satu jalur)
                    let buffer: Buffer | null = null;
                    try {
                      buffer = (await this.fileUploadService.downloadFile(file.path)).buffer;
                    } catch (err: any) {
                      buffer = null;
                    }
                    if (buffer) {
                        archive.append(buffer, { name: file.name });
                        fileCount++;
                    }
                } catch (err) {
                    // Lewati file yang gagal diambil
                    this.logger.warn(`Gagal mengambil file ${file.name}: ${err.message}`);
                }
            }
        }

        if (fileCount === 0) {
            archive.abort();
            res.status(404).json({ message: 'Data tidak ditemukan.' });
            return;
        }

        await archive.finalize();
    }
}