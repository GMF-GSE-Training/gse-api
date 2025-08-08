import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CotResponse, CreateCot, UpdateCot, DashboardStatsResponse } from "src/model/cot.model";
import { buildResponse, ListRequest, WebResponse } from "src/model/web.model";
import { CotService } from "./cot.service";
import { CertificateService } from "../certificate/certificate.service";
import { Roles } from "src/shared/decorator/role.decorator";
import { AuthGuard } from "src/shared/guard/auth.guard";
import { RoleGuard } from "src/shared/guard/role.guard";
import { CurrentUserRequest } from "src/model/auth.model";
import { User } from "src/shared/decorator/user.decorator";

@Controller('/cot')
export class CotController {
    constructor(
        private readonly cotService: CotService,
        private readonly certificateService: CertificateService
    ) { }

    @Post()
    @HttpCode(200)
    @Roles('super admin')
    @UseGuards(AuthGuard, RoleGuard)
    async create(@Body() request: CreateCot): Promise<WebResponse<string>> {
        const result = await this.cotService.createCot(request);
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/dashboard-stats')
    @HttpCode(200)
    @Roles('super admin', 'supervisor', 'lcu', 'user')
    @UseGuards(AuthGuard, RoleGuard)
    async getDashboardStats(
        @User() user: CurrentUserRequest,
        @Query('year', new ParseIntPipe({ optional: true, exceptionFactory: () => new HttpException('Year must be a valid number', 400) })) year?: number,
    ): Promise<WebResponse<DashboardStatsResponse>> {
        const targetYear = year || new Date().getFullYear();
        const result = await this.cotService.getDashboardStats(targetYear, user);
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/kompetensi-gse-operator')
    @HttpCode(200)
    @Roles('super admin', 'supervisor', 'lcu', 'user')
    @UseGuards(AuthGuard, RoleGuard)
    async getKompetensiGseOperatorData(
        @User() user: CurrentUserRequest,
        @Query('year', new ParseIntPipe({ optional: true, exceptionFactory: () => new HttpException('Year must be a valid number', 400) })) year?: number,
    ): Promise<WebResponse<any>> {
        const targetYear = year || new Date().getFullYear();
        const result = await this.cotService.getKompetensiGseOperatorData(targetYear, user);
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/list')
    @HttpCode(200)
    @Roles('super admin', 'supervisor', 'lcu', 'user')
    @UseGuards(AuthGuard, RoleGuard)

    async list(
        @User() user: CurrentUserRequest,
        @Query('q') q?: string,
        @Query('page', new ParseIntPipe({ optional: true, exceptionFactory: () => new HttpException('Page must be a positive number', 400) })) page?: number,
        @Query('size', new ParseIntPipe({ optional: true, exceptionFactory: () => new HttpException('Size must be a positive number', 400) })) size?: number,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('sort_by') sortBy?: string,
        @Query('sort_order') sortOrder?: 'asc' | 'desc',
    ): Promise<WebResponse<CotResponse[]>> {
        const validateDate = (dateStr: string) => {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                throw new HttpException(`Invalid date format: ${dateStr}`, 400);
            }
            return date;
        };

        const query: ListRequest = { 
            searchQuery: q,
            page: page || 1,
            size: size || 10,
            startDate: startDate ? validateDate(startDate) : undefined,
            endDate: endDate ? validateDate(endDate) : undefined,
            sortBy: sortBy || 'startDate',
            sortOrder: sortOrder || 'asc',
        };
        const result = await this.cotService.listCot(query, user);
        return buildResponse(HttpStatus.OK, result.data, null, result.actions, result.paging, undefined, result.info);
    }

    @Get('/:cotId')
    @HttpCode(200)
    @Roles('super admin', 'supervisor', 'lcu', 'user')
    @UseGuards(AuthGuard, RoleGuard)
    async get(@User() user: CurrentUserRequest, @Param('cotId', ParseUUIDPipe) cotId: string): Promise<WebResponse<CotResponse>> {
        const result = await this.cotService.getCot(cotId, user);
        return buildResponse(HttpStatus.OK, result);
    }

    @Patch('/:cotId')
    @HttpCode(200)
    @Roles('super admin')
    @UseGuards(AuthGuard, RoleGuard)
    async update(@Param('cotId', ParseUUIDPipe) cotId: string, @Body() request: UpdateCot): Promise<WebResponse<string>> {
        request.startDate =  request.startDate ? new Date(request.startDate) : undefined;
        request.endDate =  request.endDate ? new Date(request.endDate) : undefined;
        const result = await this.cotService.updateCot(cotId, request);
        return buildResponse(HttpStatus.OK, result);
    }

    @Delete('/:cotId')
    @HttpCode(200)
    @Roles('super admin')
    @UseGuards(AuthGuard, RoleGuard)
    async delete(@Param('cotId', ParseUUIDPipe) cotId: string): Promise<WebResponse<string>> {
        const result = await this.cotService.deleteCot(cotId);
        return buildResponse(HttpStatus.OK, result);
    }

    // Endpoint untuk certificate dengan URL format yang digunakan frontend
    // Menggunakan query parameter untuk participantId
    @Get('/certificate/:cotId/view')
    @HttpCode(200)
    @Roles('super admin', 'supervisor', 'lcu', 'user')
    @UseGuards(AuthGuard, RoleGuard)
    async getCertificateViewForCot(
        @Param('cotId', ParseUUIDPipe) cotId: string,
        @User() user: CurrentUserRequest,
        @Query('participantId') participantId?: string,
    ): Promise<WebResponse<string>> {
        // Tentukan participantId yang akan digunakan
        let targetParticipantId: string;
        
        if (user.role.name.toLowerCase() === 'user') {
            // User biasa hanya bisa akses sertifikat mereka sendiri
            if (!user.participantId) {
                throw new HttpException('User tidak terkait dengan participant', 403);
            }
            targetParticipantId = user.participantId;
            
            // Jika user mencoba akses sertifikat participant lain, tolak
            if (participantId && participantId !== user.participantId) {
                throw new HttpException('Anda tidak bisa mengakses sertifikat participant lain', 403);
            }
        } else {
            // Admin/supervisor/lcu perlu mengirim participantId
            if (!participantId) {
                throw new HttpException(
                    'Untuk admin/supervisor/lcu, participantId harus disertakan sebagai query parameter: ?participantId=xxx',
                    400
                );
            }
            targetParticipantId = participantId;
        }

        // Cari certificate untuk participant ini di COT ini
        const certificate = await this.certificateService.checkCertificateByParticipant(cotId, targetParticipantId);
        if (!certificate) {
            throw new HttpException('Sertifikat tidak ditemukan untuk participant ini di COT ini', 404);
        }

        // Ambil file certificate menggunakan certificate ID
        const fileBuffer = await this.certificateService.streamFile(certificate.id, user);
        const result = fileBuffer.toString('base64');
        return buildResponse(HttpStatus.OK, result);
    }
}
