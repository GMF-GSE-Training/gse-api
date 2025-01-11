import { HttpException, Injectable } from "@nestjs/common";
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
    constructor(
        private readonly prismaService: PrismaService,
        private readonly validationService: ValidationService,
        private readonly configService: ConfigService,
        private readonly coreHelper: CoreHelper,
    ) {}

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

    async downloadIdCard(participantId: string): Promise<Buffer> {
        const participant = await this.prismaService.participant.findUnique({
            where: { id: participantId },
            select: {
                idNumber: true,
                name: true,
                foto: true,
                company: true,
                nationality: true,
                qrCode: true,
            }
        });
    
        if (!participant) {
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
    
        if (!participant.foto || !participant.company || !participant.nationality || !participant.qrCode) {
            throw new HttpException('ID Card tidak bisa diunduh, lengkapi data terlebih dahulu', 400);
        }
    
        // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
        const networkInterfaces = os.networkInterfaces();
        let localIp = 'localhost'; // Default fallback
        
        // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
        for (const interfaceName in networkInterfaces) {
            const addresses = networkInterfaces[interfaceName];
            if (addresses) {
                for (const addr of addresses) {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
                        break;
                    }
                }
            }
        }
    
        const gmfLogoUrl = `http://${localIp}:3000/assets/images/Logo_GMF_Aero_Asia.png`;
    
        const photoBase64 = participant.foto.toString('base64');
        const qrCodeBase64 = participant.qrCode.toString('base64');
        const photoType = this.getMediaType(participant.foto);
        const qrCodeType = this.getMediaType(participant.qrCode);
    
        // Render EJS template
        const templatePath = join(__dirname, '..', 'templates', 'id-card', 'id-card.ejs');
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
    
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(idCard, { waitUntil: 'networkidle0' });
    
        const pdfBuffer = await page.pdf({ format: 'A4' });
    
        await browser.close(); // Don't forget to close the browser after generating PDF
    
        return Buffer.from(pdfBuffer);
    }

    async downloadDocument(participantId: string): Promise<Buffer> {
        const participant = await this.prismaService.participant.findUnique({
            where: { id: participantId },
            select: {
                name: true,
                simA: true,
                simB: true,
                ktp: true,
                suratSehatButaWarna: true,
                suratBebasNarkoba: true
            }
        });
    
        if (!participant) {
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
    
        if (!participant.simA || !participant.ktp || !participant.suratSehatButaWarna || !participant.suratBebasNarkoba) {
            throw new HttpException('Dokumen belum lengkap, lengkapi data terlebih dahulu', 400);
        }
    
        const pdfDoc = await PDFDocument.create();
    
        // Helper function to handle both image and PDF
        const addFileToPdf = async (fileBuffer: Buffer, fileName: string) => {
            try {
                const mimeType = this.getMediaType(fileBuffer);
                
                if (mimeType.startsWith('application/pdf')) {
                    const existingPdf = await PDFDocument.load(fileBuffer);
                    const copiedPages = await pdfDoc.copyPages(existingPdf, existingPdf.getPageIndices());
                    copiedPages.forEach((page) => pdfDoc.addPage(page));
                } else if (mimeType.startsWith('image/')) {
                    const page = pdfDoc.addPage();
                    const { width, height } = page.getSize();
                    const imageBytes = fileBuffer;
                    
                    let embeddedImage: PDFImage;
                    if (mimeType === 'image/jpeg') {
                        embeddedImage = await pdfDoc.embedJpg(imageBytes);
                    } else if (mimeType === 'image/png') {
                        embeddedImage = await pdfDoc.embedPng(imageBytes);
                    } else {
                        console.log(`Format gambar '${fileName}' tidak didukung`);
                        return;
                    }
                
                    // Scale image to fit page while maintaining aspect ratio
                    const scale = Math.min(
                        width / embeddedImage.width, 
                        height / embeddedImage.height
                    );
                    const scaledWidth = embeddedImage.width * scale;
                    const scaledHeight = embeddedImage.height * scale;
    
                    page.drawImage(embeddedImage, {
                        x: (width - scaledWidth) / 2,
                        y: (height - scaledHeight) / 2,
                        width: scaledWidth,
                        height: scaledHeight,
                    });
                } else {
                    console.log(`Format gambar '${fileName}' tidak didukung`);
                }
            } catch (error) {
                console.error(`Error processing ${fileName}:`, error);
                throw new HttpException(`Gagal memproses dokumen ${fileName}`, 500);
            }
        };

        // Add each document to the final PDF
        await addFileToPdf(Buffer.from(participant.simA), 'SIM A');
        await addFileToPdf(Buffer.from(participant.ktp), 'KTP');
        await addFileToPdf(Buffer.from(participant.suratSehatButaWarna), 'Surat Sehat Buta Warna');
        await addFileToPdf(Buffer.from(participant.suratBebasNarkoba), 'Surat Bebas Narkoba');

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    }

    async getIdCard(participantId: string): Promise<string> {
        const participant = await this.prismaService.participant.findUnique({
            where: { id: participantId },
        });
    
        if (!participant) {
            throw new HttpException('Peserta tidak ditemukan', 404);
        }
    
        if (!participant.foto || !participant.company || !participant.nationality || !participant.qrCode) {
            throw new HttpException('ID Card tidak bisa dilihat, lengkapi data terlebih dahulu', 400);
        }

        // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
        const networkInterfaces = os.networkInterfaces();
        let localIp = 'localhost'; // Default fallback
        
        // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
        for (const interfaceName in networkInterfaces) {
            const addresses = networkInterfaces[interfaceName];
            if (addresses) {
                for (const addr of addresses) {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
                        break;
                    }
                }
            }
        }

        const gmfLogoUrl = `http://${localIp}:3000/assets/images/Logo_GMF_Aero_Asia.png`;
        const photoBase64 = participant.foto.toString('base64');
        const qrCodeBase64 = participant.qrCode.toString('base64');
        const photoType = this.getMediaType(participant.foto);
        const qrCodeType = this.getMediaType(participant.qrCode);

        // Render EJS template
        const templatePath = join(__dirname, '..', 'templates', 'id-card', 'id-card.ejs');
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
    
        return idCard;
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

        return "Participant berhasil diperbari";
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
            where: {
                id: participantId
            },
        });
        return participant
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

    private getMediaType(buffer: Buffer): string {
        const header = buffer.toString('hex', 0, 4);
        if (header.startsWith('89504e47')) return 'image/png'; // PNG
        if (header.startsWith('ffd8ff')) return 'image/jpeg'; // JPEG
        if (header.startsWith('25504446')) return 'application/pdf'; // PDF
        throw new Error('Unable to detect file type');
    }
}
