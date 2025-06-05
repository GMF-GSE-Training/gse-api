import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import type { CurrentUserRequest } from '../model/auth.model.js';
import { ESignResponse } from '../model/e-sign.model.js';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import type { CreateESignDto, UpdateESignDto } from './dto/e-sign.dto.js';
import { ESignService } from './e-sign.service.js';

/**
 * Controller untuk mengelola E-Sign.
 * @controller
 */
@ApiTags('E-Sign')
@Controller('e-sign')
export class ESignController {
  constructor(
    @InjectPinoLogger(ESignController.name) private readonly logger: PinoLogger,
    private readonly eSignService: ESignService
  ) {}

  /**
   * Membuat E-Sign baru dengan file tanda tangan.
   * @param request - Data E-Sign (idNumber, role, name, signatureType, status).
   * @param files - File tanda tangan (field: eSign, format: PNG/JPEG, maks: 2MB).
   * @param dto
   * @param files.eSign
   * @returns ID E-Sign yang dibuat.
   * @throws HttpException - Jika file kosong, format tidak valid, atau ukuran melebihi batas.
   * @example
   * POST /e-sign
   * Content-Type: multipart/form-data
   * Body:
   * - eSign: (file PNG/JPEG)
   * - idNumber: "EMP001"
   * - role: "Direktur"
   * - name: "John Doe"
   * - signatureType: "SIGNATURE1"
   * - status: "true"
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'eSign', maxCount: 1 }]))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Membuat E-Sign baru' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'E-Sign berhasil dibuat',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'File kosong, format tidak valid, atau ukuran melebihi batas',
  })
  @ApiBearerAuth()
  async create(
    @Body() dto: CreateESignDto,
    @UploadedFiles() files: { eSign?: Express.Multer.File[] }
  ): Promise<WebResponse<string>> {
    this.logger.info({
      action: 'create_e_sign',
      message: 'Membuat E-Sign baru',
    });

    if (!files?.eSign?.[0]) {
      this.logger.error({
        action: 'create_e_sign',
        message: 'File E-Sign tidak ditemukan',
      });
      throw new HttpException(
        'File E-Sign wajib diisi',
        HttpStatus.BAD_REQUEST
      );
    }

    const file = files.eSign[0];
    const maxSize = 2 * 1024 * 1024;
    const allowedMimeTypes = ['image/png', 'image/jpeg'];

    if (file.size > maxSize) {
      this.logger.error({
        action: 'create_e_sign',
        message: `Ukuran file melebihi batas: ${file.size} byte`,
      });
      throw new HttpException(
        'File E-Sign melebihi ukuran maksimum 2MB',
        HttpStatus.BAD_REQUEST
      );
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      this.logger.error({
        action: 'create_e_sign',
        message: `Tipe MIME tidak valid: ${file.mimetype}`,
      });
      throw new HttpException(
        'File E-Sign harus berupa PNG atau JPEG',
        HttpStatus.BAD_REQUEST
      );
    }

    dto.eSign = file;
    const result = await this.eSignService.createESign(dto);
    this.logger.info({
      action: 'create_e_sign',
      message: `E-Sign berhasil dibuat dengan ID: ${result}`,
    });
    return buildResponse(HttpStatus.CREATED, result);
  }

  /**
   * Memperbarui E-Sign berdasarkan ID.
   * @param eSignId - ID E-Sign (UUID).
   * @param request - Data E-Sign yang akan diperbarui (opsional).
   * @param files - File tanda tangan baru (opsional, field: eSign, PNG/JPEG, maks: 2MB).
   * @param dto
   * @param files.eSign
   * @returns Pesan konfirmasi pembaruan.
   * @throws HttpException - Jika ID tidak valid, file tidak valid, atau E-Sign tidak ditemukan.
   * @example
   * PATCH /e-sign/123e4567-e89b-12d3-a456-426614174000
   * Content-Type: multipart/form-data
   * Body:
   * - eSign: (file PNG/JPEG, opsional)
   * - name: "Jane Doe" (opsional)
   */
  @Patch('/:eSignId')
  @HttpCode(HttpStatus.OK)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'eSign', maxCount: 1 }]))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Memperbarui E-Sign berdasarkan ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'E-Sign berhasil diperbarui',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'File tidak valid atau ID tidak valid',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'E-Sign tidak ditemukan',
  })
  @ApiBearerAuth()
  async update(
    @Param('eSignId', ParseUUIDPipe) eSignId: string,
    @Body() dto: UpdateESignDto,
    @UploadedFiles() files: { eSign?: Express.Multer.File[] }
  ): Promise<WebResponse<string>> {
    this.logger.info({
      action: 'update_e_sign',
      message: `Memperbarui E-Sign dengan ID: ${eSignId}`,
    });

    if (files?.eSign?.[0]) {
      const file = files.eSign[0];
      const maxSize = 2 * 1024 * 1024;
      const allowedMimeTypes = ['image/png', 'image/jpeg'];

      if (file.size > maxSize) {
        this.logger.error({
          action: 'update_e_sign',
          message: `Ukuran file melebihi batas: ${file.size} byte`,
        });
        throw new HttpException(
          'File E-Sign melebihi ukuran maksimum 2MB',
          HttpStatus.BAD_REQUEST
        );
      }

      if (!allowedMimeTypes.includes(file.mimetype)) {
        this.logger.error({
          action: 'update_e_sign',
          message: `Tipe MIME tidak valid: ${file.mimetype}`,
        });
        throw new HttpException(
          'File E-Sign harus berupa PNG atau JPEG',
          HttpStatus.BAD_REQUEST
        );
      }
      dto.eSign = file;
    }

    const result = await this.eSignService.updateESign(eSignId, dto);
    this.logger.info({
      action: 'update_e_sign',
      message: `E-Sign berhasil diperbarui: ${eSignId}`,
    });
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   * Mendapatkan detail E-Sign berdasarkan ID.
   * @param eSignId - ID E-Sign (UUID).
   * @returns Data E-Sign (id, idNumber, role, name, eSignId, signatureType, status).
   * @throws HttpException - Jika ID tidak valid atau E-Sign tidak ditemukan.
   * @example
   * GET /e-sign/123e4567-e89b-12d3-a456-426614174000
   */
  @Get('/:eSignId')
  @HttpCode(HttpStatus.OK)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  @ApiOperation({ summary: 'Mengambil detail E-Sign berdasarkan ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data E-Sign berhasil diambil',
    type: ESignResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'E-Sign tidak ditemukan',
  })
  @ApiBearerAuth()
  async get(
    @Param('eSignId', ParseUUIDPipe) eSignId: string
  ): Promise<WebResponse<ESignResponse>> {
    this.logger.info({
      action: 'get_e_sign',
      message: `Mengambil E-Sign dengan ID: ${eSignId}`,
    });
    const result = await this.eSignService.getESign(eSignId);
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   * Menampilkan file E-Sign sebagai base64.
   * @param eSignId - ID E-Sign (UUID).
   * @returns File E-Sign dalam format base64.
   * @throws HttpException - Jika ID tidak valid atau file tidak ditemukan.
   * @example
   * GET /e-sign/123e4567-e89b-12d3-a456-426614174000/view
   */
  @Get('/:eSignId/view')
  @HttpCode(HttpStatus.OK)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  @ApiOperation({ summary: 'Menampilkan file E-Sign sebagai base64' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File E-Sign berhasil ditampilkan dalam format base64',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File E-Sign tidak ditemukan',
  })
  @ApiBearerAuth()
  async getESignFile(
    @Param('eSignId', ParseUUIDPipe) eSignId: string
  ): Promise<WebResponse<string>> {
    this.logger.info({
      action: 'stream_e_sign',
      message: `Menampilkan file E-Sign untuk ID: ${eSignId}`,
    });
    const fileBuffer = await this.eSignService.streamFile(eSignId);
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   * Menghapus E-Sign berdasarkan ID.
   * @param eSignId - ID E-Sign (UUID).
   * @returns Pesan konfirmasi penghapusan.
   * @throws HttpException - Jika ID tidak valid atau E-Sign tidak ditemukan.
   * @example
   * DELETE /e-sign/123e4567-e89b-12d3-a456-426614174000
   */
  @Delete('/:eSignId')
  @HttpCode(HttpStatus.OK)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  @ApiOperation({ summary: 'Menghapus E-Sign berdasarkan ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'E-Sign berhasil dihapus',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'E-Sign tidak ditemukan',
  })
  @ApiBearerAuth()
  async delete(
    @Param('eSignId', ParseUUIDPipe) eSignId: string
  ): Promise<WebResponse<string>> {
    this.logger.info({
      action: 'delete_e_sign',
      message: `Menghapus E-Sign dengan ID: ${eSignId}`,
    });
    const result = await this.eSignService.deleteESign(eSignId);
    this.logger.info({
      action: 'delete_e_sign',
      message: `E-Sign berhasil dihapus: ${eSignId}`,
    });
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   * Mendapatkan daftar E-Sign dengan pagination dan pencarian.
   * @param user - Informasi pengguna saat ini.
   * @param q - Query pencarian (opsional, mencari idNumber, role, atau name).
   * @param page - Nomor halaman (opsional, default: 1).
   * @param size - Jumlah item per halaman (opsional, default: 10).
   * @returns Daftar E-Sign dengan pagination dan hak akses.
   * @example
   * GET /e-sign/list/result?q=john&page=1&size=10
   */
  @Get('/list/result')
  @HttpCode(HttpStatus.OK)
  @Roles('super admin', 'supervisor')
  @UseGuards(AuthGuard, RoleGuard)
  @ApiOperation({ summary: 'Mengambil daftar E-Sign dengan pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Daftar E-Sign berhasil diambil',
    type: ESignResponse,
    isArray: true,
  })
  @ApiBearerAuth()
  async list(
    @User() user: CurrentUserRequest,
    @Query('q') q: string,
    @Query('page') page?: number,
    @Query('size') size?: number
  ): Promise<WebResponse<ESignResponse[]>> {
    this.logger.info({
      action: 'list_e_sign',
      message: `Mengambil daftar E-Sign untuk pengguna: ${user.email}`,
    });
    const query: ListRequest = {
      searchQuery: q,
      page: page || 1,
      size: size || 10,
    };
    const result = await this.eSignService.listESign(query, user);
    return buildResponse(
      HttpStatus.OK,
      result.data,
      undefined,
      result.actions,
      result.paging
    );
  }
}