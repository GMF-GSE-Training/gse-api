import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import type { Response } from 'express';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../auth/enums/role.enum.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { CurrentUserRequest } from '../model/auth.model.js';
import type {
  CreateParticipantRequest,
  ParticipantResponse,
  UpdateParticipantRequest,
  ListParticipantResponse,
} from '../model/participant.model.js';
import type { WebResponse, ListRequest } from '../model/web.model.js';
import { buildResponse } from '../model/web.model.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';

import { ParticipantService } from './participant.service.js';

/**
 *
 */
@Controller('/participants')
export class ParticipantController {
  /**
   *
   * @param participantService
   */
  constructor(private readonly participantService: ParticipantService) {}

  /**
   *
   * @param user
   * @param createParticipantDto
   * @param files
   * @param files.simA
   * @param files.simB
   * @param files.ktp
   * @param files.foto
   * @param files.suratSehatButaWarna
   * @param files.suratBebasNarkoba
   */
  @Post()
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU)
  @UseGuards(AuthGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'simA', maxCount: 1 },
      { name: 'simB', maxCount: 1 },
      { name: 'ktp', maxCount: 1 },
      { name: 'foto', maxCount: 1 },
      { name: 'suratSehatButaWarna', maxCount: 1 },
      { name: 'suratBebasNarkoba', maxCount: 1 },
    ])
  )
  async create(
    @User() user: CurrentUserRequest,
    @Body() createParticipantDto: CreateParticipantRequest,
    @UploadedFiles()
    files: Record<string, Express.Multer.File[]>
  ): Promise<WebResponse<ParticipantResponse>> {
    // Konversi tanggal ke string/null/undefined dan filter file null
    const dto: any = {
      ...createParticipantDto,
      dateOfBirth: createParticipantDto.dateOfBirth
        ? String(createParticipantDto.dateOfBirth)
        : undefined,
      tglKeluarSuratSehatButaWarna:
        createParticipantDto.tglKeluarSuratSehatButaWarna
          ? String(createParticipantDto.tglKeluarSuratSehatButaWarna)
          : undefined,
      tglKeluarSuratBebasNarkoba:
        createParticipantDto.tglKeluarSuratBebasNarkoba
          ? String(createParticipantDto.tglKeluarSuratBebasNarkoba)
          : undefined,
    };
    // Hapus property file yang null
    for (const key of [
      'simA',
      'simB',
      'ktp',
      'foto',
      'suratSehatButaWarna',
      'suratBebasNarkoba',
    ]) {
      if (dto[key] === null) delete dto[key];
    }
    return await this.participantService.create(dto, files);
  }

  /**
   *
   * @param user
   * @param participantId
   * @param req
   * @param files
   * @param files.simA
   * @param files.simB
   * @param files.ktp
   * @param files.foto
   * @param files.suratSehatButaWarna
   * @param files.suratBebasNarkoba
   */
  @Patch('/:participantId')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'simA', maxCount: 1 },
      { name: 'simB', maxCount: 1 },
      { name: 'ktp', maxCount: 1 },
      { name: 'foto', maxCount: 1 },
      { name: 'suratSehatButaWarna', maxCount: 1 },
      { name: 'suratBebasNarkoba', maxCount: 1 },
    ])
  )
  async update(
    @User() user: CurrentUserRequest,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() req: UpdateParticipantRequest,
    @UploadedFiles() files: Record<string, Express.Multer.File[]>
  ): Promise<WebResponse<ParticipantResponse>> {
    const dto: any = {
      ...req,
      dateOfBirth: req.dateOfBirth ? String(req.dateOfBirth) : undefined,
      tglKeluarSuratSehatButaWarna: req.tglKeluarSuratSehatButaWarna
        ? String(req.tglKeluarSuratSehatButaWarna)
        : undefined,
      tglKeluarSuratBebasNarkoba: req.tglKeluarSuratBebasNarkoba
        ? String(req.tglKeluarSuratBebasNarkoba)
        : undefined,
    };
    for (const key of [
      'simA',
      'simB',
      'ktp',
      'foto',
      'suratSehatButaWarna',
      'suratBebasNarkoba',
    ]) {
      if (dto[key] === null) delete dto[key];
    }
    return await this.participantService.update(participantId, dto);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/sim-a')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async getSimA(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'simA'
    );
    const result = fileBuffer.stream.read().toString('base64');
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/sim-b')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async getSimB(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'simB'
    );
    const result = fileBuffer.stream.read().toString('base64');
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/foto')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async getFoto(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'foto'
    );
    const result = fileBuffer.stream.read().toString('base64');
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/ktp')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async getKTP(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'ktp'
    );
    const result = fileBuffer.stream.read().toString('base64');
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/surat-sehat-buta-warna')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async getSuratSehat(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'suratSehatButaWarna'
    );
    const result = fileBuffer.stream.read().toString('base64');
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/surat-bebas-narkoba')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async getSuratKetBebasNarkoba(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'suratBebasNarkoba'
    );
    const result = fileBuffer.stream.read().toString('base64');
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/qr-code')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async getQrCode(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'qrCode'
    );
    const result = fileBuffer.stream.read().toString('base64');
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU, Role.USER)
  @UseGuards(AuthGuard, RolesGuard)
  async get(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<ParticipantResponse>> {
    return await this.participantService.get(participantId);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/id-card')
  @Roles(Role.SUPER_ADMIN, Role.LCU, Role.SUPERVISOR)
  @UseGuards(AuthGuard, RolesGuard)
  @HttpCode(200)
  async getIdCard(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<{ pdfBuffer: Buffer; participantName: string }> {
    try {
      return await this.participantService.getIdCard(participantId);
    } catch (error) {
      throw new HttpException(
        (error as any).message,
        (error as any).status || 500
      );
    }
  }

  /**
   *
   * @param participantId
   * @param res
   */
  @Get('/:participantId/id-card/download')
  @Roles(Role.SUPER_ADMIN, Role.LCU)
  @UseGuards(AuthGuard, RolesGuard)
  @HttpCode(200)
  async downloadIdCard(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      const { pdfBuffer, participantName } =
        await this.participantService.downloadIdCard(participantId);
      const sanitizedName = participantName
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `ID_Card_${sanitizedName}_${participantId}.pdf`;
      const encodedFilename = encodeURIComponent(filename);
      const disposition = `attachment; filename=\"${filename}\"; filename*=UTF-8''${encodedFilename}`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'X-Participant-Name': sanitizedName,
      });
      res.send(pdfBuffer);
    } catch (error) {
      throw new HttpException(
        (error as any).message,
        (error as any).status || 500
      );
    }
  }

  /**
   *
   * @param user
   * @param q
   * @param page
   * @param size
   */
  @Get('/list/result')
  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.LCU)
  @UseGuards(AuthGuard, RolesGuard)
  async list(
    @User() user: CurrentUserRequest,
    @Query('q') q?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('size', new ParseIntPipe({ optional: true })) size?: number
  ): Promise<WebResponse<ListParticipantResponse[]>> {
    const query: ListRequest = {
      search: q,
      page: page || 1,
      size: size || 10,
    };
    return await this.participantService.list(query, user);
  }
}
