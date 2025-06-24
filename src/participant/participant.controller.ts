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
import { ParticipantService } from './participant.service';
import {
  CreateParticipantRequest,
  ParticipantResponse,
  UpdateParticipantRequest,
} from '../model/participant.model';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model';
import { AuthGuard } from '../shared/guard/auth.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RoleGuard } from '../shared/guard/role.guard';
import { Roles } from '../shared/decorator/role.decorator';
import { CurrentUserRequest } from 'src/model/auth.model';
import { User } from 'src/shared/decorator/user.decorator';
import { Response } from 'express';
import { CoreHelper } from 'src/common/helpers/core.helper';

@Controller('/participants')
export class ParticipantController {
  constructor(
    private readonly participantService: ParticipantService,
    private readonly coreHelper: CoreHelper,
  ) {}

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
    ]),
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
    },
  ): Promise<WebResponse<ParticipantResponse>> {
    let participantData: CreateParticipantRequest;
    try {
      participantData = {
        ...createParticipantDto,
        dateOfBirth: new Date(createParticipantDto.dateOfBirth),
        tglKeluarSuratSehatButaWarna: new Date(
          createParticipantDto.tglKeluarSuratSehatButaWarna,
        ),
        tglKeluarSuratBebasNarkoba: new Date(
          createParticipantDto.tglKeluarSuratBebasNarkoba,
        ),
        simA: files.simA ? files.simA[0].buffer : null,
        simB: files.simB ? files.simB[0].buffer : null,
        ktp: files.ktp ? files.ktp[0].buffer : null,
        foto: files.foto ? files.foto[0].buffer : null,
        suratSehatButaWarna: files.suratSehatButaWarna
          ? files.suratSehatButaWarna[0].buffer
          : null,
        suratBebasNarkoba: files.suratBebasNarkoba
          ? files.suratBebasNarkoba[0].buffer
          : null,
      };
    } catch (error) {
      throw new HttpException('Semua file/image tidak boleh kosong', 400);
    }

    const participant = await this.participantService.createParticipant(
      participantData,
      user,
    );
    return buildResponse(HttpStatus.OK, participant);
  }

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
    ]),
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
    },
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
    fileKeys.forEach((field) => {
      if (files[field] && files[field][0].size > maxSize) {
        const fieldName = fileNames[field] || field;
        throw new HttpException(
          `File ${fieldName} melebihi ukuran maksimum 2MB.`,
          400,
        );
      }
    });

    const participantData = {
      ...req,
      dateOfBirth: req.dateOfBirth ? new Date(req.dateOfBirth) : undefined,
      tglKeluarSuratSehatButaWarna: req.tglKeluarSuratSehatButaWarna
        ? new Date(req.tglKeluarSuratSehatButaWarna)
        : undefined,
      tglKeluarSuratBebasNarkoba: req.tglKeluarSuratBebasNarkoba
        ? new Date(req.tglKeluarSuratBebasNarkoba)
        : undefined,
      simA: files?.simA?.[0]?.buffer || undefined,
      simB: files?.simB?.[0]?.buffer || undefined,
      ktp: files?.ktp?.[0]?.buffer || undefined,
      foto: files?.foto?.[0]?.buffer || undefined,
      suratSehatButaWarna: files?.suratSehatButaWarna?.[0]?.buffer || undefined,
      suratBebasNarkoba: files?.suratBebasNarkoba?.[0]?.buffer || undefined,
    };

    const result = await this.participantService.updateParticipant(
      participantId,
      participantData,
      user,
    );
    return buildResponse(HttpStatus.OK, result);
  }

  @Get('/:participantId/sim-a')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSimA(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
    @Res() res: Response,
  ): Promise<void> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'simA',
      user,
    );
    if (fileBuffer) {
      const mediaType = this.coreHelper.getMediaType(fileBuffer);
      res.setHeader('Content-Type', mediaType || 'application/octet-stream');
      res.send(fileBuffer);
    } else {
      res.status(404).send('SIM A not found');
    }
  }

  @Get('/:participantId/sim-b')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSimB(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
    @Res() res: Response,
  ): Promise<void> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'simB',
      user,
    );
    if (fileBuffer) {
      const mediaType = this.coreHelper.getMediaType(fileBuffer);
      res.setHeader('Content-Type', mediaType || 'application/octet-stream');
      res.send(fileBuffer);
    } else {
      res.status(404).send('SIM B not found');
    }
  }

  @Get('/:participantId/foto')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getFoto(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
    @Res() res: Response,
  ): Promise<void> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'foto',
      user,
    );
    if (fileBuffer) {
      const mediaType = this.coreHelper.getMediaType(fileBuffer);
      res.setHeader('Content-Type', mediaType || 'application/octet-stream');
      res.send(fileBuffer);
    } else {
      res.status(404).send('Foto not found');
    }
  }

  @Get('/:participantId/ktp')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getKTP(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
    @Res() res: Response,
  ): Promise<void> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'ktp',
      user,
    );
    if (fileBuffer) {
      const mediaType = this.coreHelper.getMediaType(fileBuffer);
      res.setHeader('Content-Type', mediaType || 'application/octet-stream');
      res.send(fileBuffer);
    } else {
      res.status(404).send('KTP not found');
    }
  }

  @Get('/:participantId/surat-sehat-buta-warna')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSuratSehat(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
    @Res() res: Response,
  ): Promise<void> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'suratSehatButaWarna',
      user,
    );
    if (fileBuffer) {
      const mediaType = this.coreHelper.getMediaType(fileBuffer);
      res.setHeader('Content-Type', mediaType || 'application/octet-stream');
      res.send(fileBuffer);
    } else {
      res.status(404).send('Surat Sehat Buta Warna not found');
    }
  }

  @Get('/:participantId/surat-bebas-narkoba')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getSuratKetBebasNarkoba(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
    @Res() res: Response,
  ): Promise<void> {
    const fileBuffer = await this.participantService.streamFile(
      participantId,
      'suratBebasNarkoba',
      user,
    );
    if (fileBuffer) {
      const mediaType = this.coreHelper.getMediaType(fileBuffer);
      res.setHeader('Content-Type', mediaType || 'application/octet-stream');
      res.send(fileBuffer);
    } else {
      res.status(404).send('Surat Bebas Narkoba not found');
    }
  }

  @Get('/:participantId/qr-code')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getQrCode(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Cek participant
      let participant;
      try {
        participant = await this.participantService.getParticipantRaw(participantId);
      } catch (e) {
        res.status(404).send('Participant not found');
        return;
      }
      // Ambil QR code
      const fileBuffer = await this.participantService.getQrCode(participantId);
      let sanitizedNama = 'Participant';
      if (participant && participant.name) {
        sanitizedNama = participant.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      }
      const filename = `QRCode_${sanitizedNama}_${participantId}.png`;
      const encodedFilename = encodeURIComponent(filename);
      const disposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;
      if (fileBuffer) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', disposition);
        res.send(fileBuffer);
      } else {
        res.status(404).send('QR Code not found');
      }
    } catch (error) {
      if (error.status === 404) {
        res.status(404).send(error.message || 'Participant not found');
      } else {
        res.status(500).send(error.message || 'Internal Server Error');
      }
    }
  }

  @Get('/:participantId')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async get(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
  ): Promise<WebResponse<ParticipantResponse>> {
    const result = await this.participantService.getParticipant(
      participantId,
      user,
    );
    return buildResponse(HttpStatus.OK, result);
  }

  @Get('/:participantId/id-card')
  @Roles('super admin', 'lcu', 'supervisor')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async getIdCard(
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<string> {
    try {
      return await this.participantService.getIdCard(participantId);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @Get('/:participantId/id-card/download')
  @Roles('super admin', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async downloadIdCard(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { pdfBuffer, participantName } = await this.participantService.downloadIdCard(participantId);
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

  @Get('/:participantId/download-document')
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async downloadDocument(
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<StreamableFile> {
    try {
      const { pdfBuffer, participantName } = await this.participantService.downloadDocument(participantId);
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

  @Delete('/:participantId')
  @HttpCode(200)
  @Roles('super admin', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async delete(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @User() user: CurrentUserRequest,
  ): Promise<WebResponse<string>> {
    const result = await this.participantService.deleteParticipant(
      participantId,
      user,
    );
    return buildResponse(HttpStatus.OK, result);
  }

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
      }),
    )
    page?: number,
    @Query(
      'size',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Size must be a positive number', 400),
      }),
    )
    size?: number,
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
      result.paging,
    );
  }
}
