import { HttpException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/service/prisma.service";
import { CreateParticipantRequest, ParticipantResponse, UpdateParticipantRequest } from "../model/participant.model";
import * as QRCode from 'qrcode';
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
import * as os from 'os';

@Injectable()
export class ParticipantService {
    private readonly logger = new Logger(ParticipantService.name);
    constructor(
        private readonly prismaService: PrismaService,
        private readonly validationService: ValidationService,
        private readonly configService: ConfigService,
        private readonly coreHelper: CoreHelper,
    ) {}

    private getBaseUrl(type: 'frontend' | 'backend'): string {
        const protocol = this.configService.get<string>('PROTOCOL') || 'http';
        const host = this.configService.get<string>('HOST') || 'localhost';
        const port = this.configService.get<string>(type === 'frontend' ? 'FRONTEND_PORT' : 'PORT') || '4200';
    
        const envUrl = this.configService.get<string>(type === 'frontend' ? 'FRONTEND_URL' : 'BACKEND_URL');
        if (envUrl) {
            this.logger.debug(`Menggunakan ${type} URL dari .env: ${envUrl}`);
            return envUrl;
        }
    
        const constructedUrl = `${protocol}://${host}:${port}`;
        this.logger.warn(`Tidak ada ${type} URL di .env, menggunakan URL default: ${constructedUrl}`);
        return constructedUrl;
    }

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
                simA: createRequest.simA,
                simAFileName: createRequest.simAFileName,
                simB: createRequest.simB,
                simBFileName: createRequest.simAFileName,
                ktp: createRequest.ktp,
                ktpFileName: createRequest.ktpFileName,
                foto: createRequest.foto,
                fotoFileName: createRequest.fotoFileName,
                suratSehatButaWarna: createRequest.suratSehatButaWarna,
                suratSehatButaWarnaFileName: createRequest.suratSehatButaWarnaFileName,
                tglKeluarSuratSehatButaWarna: createRequest.tglKeluarSuratSehatButaWarna,
                suratBebasNarkoba: createRequest.suratBebasNarkoba,
                suratBebasNarkobaFileName: createRequest.suratBebasNarkobaFileName,
                tglKeluarSuratBebasNarkoba: createRequest.tglKeluarSuratBebasNarkoba,
                qrCode: null,
                gmfNonGmf: createRequest.gmfNonGmf,
            },
        });
    
        // Modifikasi qrCodeLink dengan ID peserta
        const link = this.configService.get<string>('QR_CODE_LINK').replace('{id}', participant.id);
    
        // Generate QR code
        const qrCodeBase64 = await QRCode.toDataURL(link, { width: 500 });
        const qrCodeBuffer = Buffer.from(qrCodeBase64.replace(/^data:image\/png;base64,/, ''), 'base64');

        // Update peserta dengan QR code dan link
        const result = await this.prismaService.participant.update({
            where: { id: participant.id },
            data: {
                qrCode: qrCodeBuffer,
            },
        });
    
        return this.toParticipantResponse(result);
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
    
        return participant[fileName];
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

        // Ambil data peserta
        const participant = await this.findOneParticipant(participantId);
        const requiredFields = {
            foto: participant.foto,
            company: participant.company,
            nationality: participant.nationality,
            qrCode: participant.qrCode,
        };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            this.logger.warn(`Data ID Card tidak lengkap: ${missingFields.join(', ')}`);
            throw new HttpException('ID Card tidak bisa diunduh, lengkapi data terlebih dahulu', 400);
        }

        // Konfigurasi URL dan konversi data
        const backendUrl = this.getBaseUrl('backend');
        const gmfLogoUrl = `${backendUrl}/assets/images/Logo_GMF_Aero_Asia.png`;
        const photoBase64 = Buffer.from(participant.foto).toString('base64');
        const qrCodeBase64 = Buffer.from(participant.qrCode).toString('base64');
        const photoType = this.coreHelper.getMediaType(Buffer.from(participant.foto));
        const qrCodeType = this.coreHelper.getMediaType(Buffer.from(participant.qrCode));

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
            simA: participant.simA,
            ktp: participant.ktp,
            suratSehatButaWarna: participant.suratSehatButaWarna,
            suratBebasNarkoba: participant.suratBebasNarkoba,
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
        await addFileToPdf(Buffer.from(participant.simA), 'SIM A');
        await addFileToPdf(Buffer.from(participant.ktp), 'KTP');
        await addFileToPdf(Buffer.from(participant.suratSehatButaWarna), 'Surat Sehat Buta Warna');
        await addFileToPdf(Buffer.from(participant.suratBebasNarkoba), 'Surat Bebas Narkoba');

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

        // Ambil data peserta
        const participant = await this.findOneParticipant(participantId);
        const requiredFields = {
            foto: participant.foto,
            company: participant.company,
            nationality: participant.nationality,
            qrCode: participant.qrCode,
        };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            this.logger.warn(`Data ID Card tidak lengkap: ${missingFields.join(', ')}`);
            throw new HttpException('ID Card tidak bisa dilihat, lengkapi data terlebih dahulu', 400);
        }

        // Konversi data ke base64
        const photoBase64 = Buffer.from(participant.foto).toString('base64');
        const qrCodeBase64 = Buffer.from(participant.qrCode).toString('base64');
        const photoType = this.coreHelper.getMediaType(Buffer.from(participant.foto));
        const qrCodeType = this.coreHelper.getMediaType(Buffer.from(participant.qrCode));

        // Konfigurasi URL
        const backendUrl = this.getBaseUrl('backend');
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
        
        await this.prismaService.participant.update({
            where: { id: participantId },
            data: {
                ...updateRequest,
            },
        });
    
        if(participant.nik) {
            const updateUser = {
                idNumber: updateRequest.idNumber,
                name: updateRequest.name,
                nik: updateRequest.nik,
                dinas: updateRequest.dinas,
                email: updateRequest.email,
            };

            const userUpdate = await this.prismaService.user.findUnique({
                where: {
                    participantId: participant.id,
                },
            });
        
            if(userUpdate) {
                await this.prismaService.user.update({
                    where: {
                        id: userUpdate.id,
                    },
                    data: updateUser,
                });
            }
        }

        return "Participant berhasil diperbarui";
    }

    async deleteParticipant(participantId: string, user: CurrentUserRequest): Promise<string> {
        const participant = await this.findOneParticipant(participantId);
    
        if (!participant) {
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
    
        if (user.dinas || user.dinas !== null) {
            this.validateDinasForLcuRequest(participant.dinas, user.dinas);
        }
    
        // Gunakan Prisma Transaction
        await this.prismaService.$transaction(async (prisma) => {
            // Hapus user terkait (jika ada)
            const findUser = await prisma.user.findFirst({
                where: {
                    participantId: participant.id,
                },
            });
    
            if (findUser) {
                await prisma.user.delete({
                    where: {
                        id: findUser.id,
                    },
                });
            }
    
            // Hapus data terkait di tabel participantsCOT
            await prisma.participantsCOT.deleteMany({
                where: {
                    participantId: participantId,
                },
            });
    
            // Hapus data peserta
            await prisma.participant.delete({
                where: {
                    id: participantId,
                },
            });
        });
    
        return 'Berhasil menghapus participant';
    }    

    async listParticipants(request: ListRequest, user: CurrentUserRequest):Promise<{ data: ParticipantResponse[], actions: ActionAccessRights, paging: Paging }> {
        const userRole = user.role.name.toLowerCase();
    
        const participantSelectFields = {
            id: true,
            idNumber: true,
            name: true,
            dinas: true,
            bidang: true,
            company: true,
            email: true,
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
    
        const totalUsers = await this.prismaService.participant.count({
            where: whereClause,
        });
    
        const participants = await this.prismaService.participant.findMany({
            where: whereClause,
            select: participantSelectFields,
            skip: (request.page - 1) * request.size,
            take: request.size,
        });
    
        const totalPage = Math.ceil(totalUsers / request.size);
    
        const accessRights = this.validateActions(userRole);
    
        return {
            data: participants.map(participant => this.toParticipantResponse(participant)),
            actions: accessRights,
            paging: {
                currentPage: request.page,
                totalPage: totalPage,
                size: request.size,
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
            simAFileName: participant.simAFileName,
            simBFileName: participant.simBFileName,
            ktpFileName: participant.ktpFileName,
            fotoFileName: participant.fotoFileName,
            suratSehatButaWarnaFileName: participant.suratSehatButaWarnaFileName,
            suratBebasNarkobaFileName: participant.suratBebasNarkobaFileName,
            dateOfBirth: participant.dateOfBirth,
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
}