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
import { Logger } from '@nestjs/common';
import { Public } from 'src/auth/public.decorator';

@Controller('/participants')
export class ParticipantController {
  private readonly logger = new Logger(ParticipantController.name);

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
    try {
      this.logger?.log?.(`Request download SIM A untuk participant: ${participantId}`);
      const fileBuffer = await this.participantService.streamFile(
        participantId,
        'simA',
        user,
      );
      if (fileBuffer) {
        const mediaType = this.coreHelper.getMediaType(fileBuffer);
        res.setHeader('Content-Type', mediaType || 'application/octet-stream');
        res.send(fileBuffer);
        this.logger?.log?.(`Berhasil mengirim SIM A participant: ${participantId}`);
      } else {
        res.status(404).send('SIM A not found');
        this.logger?.warn?.(`SIM A tidak ditemukan untuk participant: ${participantId}`);
      }
    } catch (error: any) {
      if (error.status === 404) {
        res.status(404).send(error.message || 'SIM A not found');
        this.logger?.warn?.(`SIM A tidak ditemukan (404) untuk participant: ${participantId}`);
      } else {
        res.status(500).send(error.message || 'Internal Server Error');
        this.logger?.error?.(`Gagal mengirim SIM A participant: ${participantId} | ${error.message}`);
      }
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
    try {
      this.logger?.log?.(`Request download SIM B untuk participant: ${participantId}`);
      const fileBuffer = await this.participantService.streamFile(
        participantId,
        'simB',
        user,
      );
      if (fileBuffer) {
        const mediaType = this.coreHelper.getMediaType(fileBuffer);
        res.setHeader('Content-Type', mediaType || 'application/octet-stream');
        res.send(fileBuffer);
        this.logger?.log?.(`Berhasil mengirim SIM B participant: ${participantId}`);
      } else {
        res.status(404).send('SIM B not found');
        this.logger?.warn?.(`SIM B tidak ditemukan untuk participant: ${participantId}`);
      }
    } catch (error: any) {
      if (error.status === 404) {
        res.status(404).send(error.message || 'SIM B not found');
        this.logger?.warn?.(`SIM B tidak ditemukan (404) untuk participant: ${participantId}`);
      } else {
        res.status(500).send(error.message || 'Internal Server Error');
        this.logger?.error?.(`Gagal mengirim SIM B participant: ${participantId} | ${error.message}`);
      }
    }
  }

  @Get('/:participantId/foto')
  @Public()
  @HttpCode(200)
  async getFoto(
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<WebResponse<string>> {
    try {
      this.logger?.log?.(`Request foto URL untuk participant: ${participantId}`);
      const result = await this.participantService.getFotoUrl(participantId);
      return buildResponse(HttpStatus.OK, result);
    } catch (error: any) {
      this.logger?.error?.(`Gagal mengambil foto URL participant: ${participantId} | ${error.message}`);
      throw new HttpException(error.message || 'Internal Server Error', error.status || 500);
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
    try {
      this.logger?.log?.(`Request download KTP untuk participant: ${participantId}`);
      const fileBuffer = await this.participantService.streamFile(
        participantId,
        'ktp',
        user,
      );
      if (fileBuffer) {
        const mediaType = this.coreHelper.getMediaType(fileBuffer);
        res.setHeader('Content-Type', mediaType || 'application/octet-stream');
        res.send(fileBuffer);
        this.logger?.log?.(`Berhasil mengirim KTP participant: ${participantId}`);
      } else {
        res.status(404).send('KTP not found');
        this.logger?.warn?.(`KTP tidak ditemukan untuk participant: ${participantId}`);
      }
    } catch (error: any) {
      if (error.status === 404) {
        res.status(404).send(error.message || 'KTP not found');
        this.logger?.warn?.(`KTP tidak ditemukan (404) untuk participant: ${participantId}`);
      } else {
        res.status(500).send(error.message || 'Internal Server Error');
        this.logger?.error?.(`Gagal mengirim KTP participant: ${participantId} | ${error.message}`);
      }
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
    try {
      this.logger?.log?.(`Request download Surat Sehat Buta Warna untuk participant: ${participantId}`);
      const fileBuffer = await this.participantService.streamFile(
        participantId,
        'suratSehatButaWarna',
        user,
      );
      if (fileBuffer) {
        const mediaType = this.coreHelper.getMediaType(fileBuffer);
        res.setHeader('Content-Type', mediaType || 'application/octet-stream');
        res.send(fileBuffer);
        this.logger?.log?.(`Berhasil mengirim Surat Sehat Buta Warna participant: ${participantId}`);
      } else {
        res.status(404).send('Surat Sehat Buta Warna not found');
        this.logger?.warn?.(`Surat Sehat Buta Warna tidak ditemukan untuk participant: ${participantId}`);
      }
    } catch (error: any) {
      if (error.status === 404) {
        res.status(404).send(error.message || 'Surat Sehat Buta Warna not found');
        this.logger?.warn?.(`Surat Sehat Buta Warna tidak ditemukan (404) untuk participant: ${participantId}`);
      } else {
        res.status(500).send(error.message || 'Internal Server Error');
        this.logger?.error?.(`Gagal mengirim Surat Sehat Buta Warna participant: ${participantId} | ${error.message}`);
      }
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
    try {
      this.logger?.log?.(`Request download Surat Bebas Narkoba untuk participant: ${participantId}`);
      const fileBuffer = await this.participantService.streamFile(
        participantId,
        'suratBebasNarkoba',
        user,
      );
      if (fileBuffer) {
        const mediaType = this.coreHelper.getMediaType(fileBuffer);
        res.setHeader('Content-Type', mediaType || 'application/octet-stream');
        res.send(fileBuffer);
        this.logger?.log?.(`Berhasil mengirim Surat Bebas Narkoba participant: ${participantId}`);
      } else {
        res.status(404).send('Surat Bebas Narkoba not found');
        this.logger?.warn?.(`Surat Bebas Narkoba tidak ditemukan untuk participant: ${participantId}`);
      }
    } catch (error: any) {
      if (error.status === 404) {
        res.status(404).send(error.message || 'Surat Bebas Narkoba not found');
        this.logger?.warn?.(`Surat Bebas Narkoba tidak ditemukan (404) untuk participant: ${participantId}`);
      } else {
        res.status(500).send(error.message || 'Internal Server Error');
        this.logger?.error?.(`Gagal mengirim Surat Bebas Narkoba participant: ${participantId} | ${error.message}`);
      }
    }
  }

  @Get('/:participantId/qr-code')
  @Public()
  @HttpCode(200)
  async getQrCode(
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ): Promise<WebResponse<string>> {
    try {
      this.logger?.log?.(`Request QR code URL untuk participant: ${participantId}`);
      const result = await this.participantService.getQrCodeUrl(participantId);
      return buildResponse(HttpStatus.OK, result);
    } catch (error: any) {
      this.logger?.error?.(`Gagal mengambil QR code URL participant: ${participantId} | ${error.message}`);
      throw new HttpException(error.message || 'Internal Server Error', error.status || 500);
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
      this.logger?.log?.(`Request download ID Card untuk participant: ${participantId}`);
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
      this.logger?.log?.(`Berhasil mengirim ID Card participant: ${participantId}`);
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
      this.logger?.log?.(`Request download Document untuk participant: ${participantId}`);
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

  @Get('/:participantId/download-all')
  @Roles('super admin', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async downloadAllFiles(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger?.log?.(`Request download all files untuk participant: ${participantId}`);
      return this.participantService.downloadAllFilesAsZip(participantId, res);
    } catch (error: any) {
      this.logger?.error?.(`Gagal mengirim all files participant: ${participantId} | ${error.message}`);
      throw new HttpException(error.message || 'Internal Server Error', error.status || 500);
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
    try {
      this.logger?.log?.(`Request delete participant: ${participantId}`);
      const result = await this.participantService.deleteParticipant(
        participantId,
        user,
      );
      return buildResponse(HttpStatus.OK, result);
    } catch (error: any) {
      this.logger?.error?.(`Gagal delete participant: ${participantId} | ${error.message}`);
      throw new HttpException(error.message || 'Internal Server Error', error.status || 500);
    }
  }

  @Get('/list/result')
  @Roles('super admin', 'supervisor', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async list(
    @User() user: CurrentUserRequest,
    @Query('q') q?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('size', new ParseIntPipe({ optional: true })) size?: number,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: 'asc' | 'desc',
  ): Promise<WebResponse<ParticipantResponse[]>> {
    const query: ListRequest = {
      searchQuery: q,
      page: page || 1,
      size: size || 10,
      sortBy: sortBy || 'idNumber',
      sortOrder: sortOrder || 'asc',
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
