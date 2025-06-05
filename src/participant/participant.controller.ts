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
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import { Response } from 'express';

import { CurrentUserRequest } from '../model/auth.model.js';
import {
  CreateParticipantRequest,
  ParticipantResponse,
  UpdateParticipantRequest,
} from '../model/participant.model.js';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

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
  @Roles('super admin', 'supervisor', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
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
    files: {
      simA?: Express.Multer.File[];
      simB?: Express.Multer.File[];
      ktp?: Express.Multer.File[];
      foto?: Express.Multer.File[];
      suratSehatButaWarna?: Express.Multer.File[];
      suratBebasNarkoba?: Express.Multer.File[];
    }
  ): Promise<WebResponse<ParticipantResponse>> {
    let participantData: CreateParticipantRequest;
    try {
      participantData = {
        ...createParticipantDto,
        dateOfBirth: createParticipantDto.dateOfBirth
          ? new Date(createParticipantDto.dateOfBirth)
          : undefined,
        tglKeluarSuratSehatButaWarna:
          createParticipantDto.tglKeluarSuratSehatButaWarna
            ? new Date(createParticipantDto.tglKeluarSuratSehatButaWarna)
            : undefined,
        tglKeluarSuratBebasNarkoba:
          createParticipantDto.tglKeluarSuratBebasNarkoba
            ? new Date(createParticipantDto.tglKeluarSuratBebasNarkoba)
            : undefined,
        simA: files.simA?.[0], // Sudah sesuai dengan tipe
        simB: files.simB?.[0],
        ktp: files.ktp?.[0],
        foto: files.foto?.[0],
        suratSehatButaWarna: files.suratSehatButaWarna?.[0],
        suratBebasNarkoba: files.suratBebasNarkoba?.[0],
      };
    } catch (error) {
      throw new HttpException('Semua file/image tidak boleh kosong', 400);
    }

    const participant = await this.participantService.createParticipant(
      participantData,
      user
    );
    return buildResponse(HttpStatus.OK, participant);
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
  @Roles('super admin', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
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
    @Body()
    req: Omit<
      UpdateParticipantRequest,
      | 'simA'
      | 'simB'
      | 'ktp'
      | 'foto'
      | 'suratSehatButaWarna'
      | 'suratBebasNarkoba'
    >,
    @UploadedFiles()
    files: {
      simA?: Express.Multer.File[];
      simB?: Express.Multer.File[];
      ktp?: Express.Multer.File[];
      foto?: Express.Multer.File[];
      suratSehatButaWarna?: Express.Multer.File[];
      suratBebasNarkoba?: Express.Multer.File[];
    }
  ): Promise<WebResponse<string>> {
    const maxSize = 2 * 1024 * 1024; // 2 MB

    const fileNames = {
      simA: 'SIM A',
      simB: 'SIM B',
      ktp: 'KTP',
      foto: 'Foto',
      suratSehatButaWarna: 'Surat Sehat Buta Warna',
      suratBebasNarkoba: 'Surat Bebas Narkoba',
    };

    const fileKeys = Object.keys(files);
    fileKeys.forEach(field => {
      if (files[field] && files[field][0].size > maxSize) {
        const fieldName = fileNames[field] || field;
        throw new HttpException(
          `File ${fieldName} melebihi ukuran maksimum 2MB.`,
          400
        );
      }
    });

    const participantData: UpdateParticipantRequest = {
      ...req,
      dateOfBirth: req.dateOfBirth ? new Date(req.dateOfBirth) : undefined,
      tglKeluarSuratSehatButaWarna: req.tglKeluarSuratSehatButaWarna
        ? new Date(req.tglKeluarSuratSehatButaWarna)
        : undefined,
      tglKeluarSuratBebasNarkoba: req.tglKeluarSuratBebasNarkoba
        ? new Date(req.tglKeluarSuratBebasNarkoba)
        : undefined,
      simA: files?.simA?.[0],
      simB: files?.simB?.[0],
      ktp: files?.ktp?.[0],
      foto: files?.foto?.[0],
      suratSehatButaWarna: files?.suratSehatButaWarna?.[0],
      suratBebasNarkoba: files?.suratBebasNarkoba?.[0],
    };

    const result = await this.participantService.updateParticipant(
      participantId,
      participantData,
      user
    );
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/sim-a')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSimA(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'simA',
      user
    );
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }
  x;

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/sim-b')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSimB(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'simB',
      user
    );
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/foto')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getFoto(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'foto',
      user
    );
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/ktp')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getKTP(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'ktp',
      user
    );
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/surat-sehat-buta-warna')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSuratSehat(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'suratSehatButaWarna',
      user
    );
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/surat-bebas-narkoba')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSuratKetBebasNarkoba(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'suratBebasNarkoba',
      user
    );
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId/qr-code')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getQrCode(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'qrCode',
      user
    );
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Get('/:participantId')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async get(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<ParticipantResponse>> {
    const result = await this.participantService.getParticipant(
      participantId,
      user
    );
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param participantId
   */
  @Get('/:participantId/id-card')
  @Roles('super admin', 'lcu', 'supervisor')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async getIdCard(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<string> {
    try {
      return await this.participantService.getIdCard(participantId);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  /**
   *
   * @param participantId
   * @param res
   */
  @Get('/:participantId/id-card/download')
  @Roles('super admin', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
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

      console.log(`Generated filename: ${filename}`);
      const encodedFilename = encodeURIComponent(filename);
      const disposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;

      // Set header secara langsung pada respons
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'X-Participant-Name': sanitizedName,
      });

      console.log(`Sending X-Participant-Name: ${sanitizedName}`);
      // Kirim buffer langsung ke client
      res.send(pdfBuffer);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  /**
   *
   * @param participantId
   */
  @Get('/:participantId/download-document')
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async downloadDocument(
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<StreamableFile> {
    try {
      const { pdfBuffer, participantName } =
        await this.participantService.downloadDocument(participantId);
      const sanitizedName = participantName
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');
      const filename = `Document_${sanitizedName}_${participantId}.pdf`;

      return new StreamableFile(pdfBuffer, {
        type: 'application/pdf',
        disposition: `attachment; filename="${filename}"`,
      });
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  /**
   *
   * @param participantId
   * @param user
   */
  @Delete('/:participantId')
  @HttpCode(200)
  @Roles('super admin', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async delete(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const result = await this.participantService.deleteParticipant(
      participantId,
      user
    );
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param user
   * @param q
   * @param page
   * @param size
   */
  @Get('/list/result')
  @Roles('super admin', 'supervisor', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async list(
    @User() user: CurrentUserRequest,
    @Query('q') q?: string,
    @Query(
      'page',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Page must be a positive number', 400),
      })
    )
    page?: number,
    @Query(
      'size',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Size must be a positive number', 400),
      })
    )
    size?: number
  ): Promise<WebResponse<ParticipantResponse[]>> {
    const query: ListRequest = {
      searchQuery: q,
      page: page || 1,
      size: size || 10,
    };
    const result = await this.participantService.listParticipants(query, user);
    return buildResponse(
      HttpStatus.OK,
      result.data,
      null,
      result.actions,
      result.paging
    );
  }
}
