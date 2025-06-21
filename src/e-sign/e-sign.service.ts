import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

import { CoreHelper } from '../common/helpers/core.helper.js';
import { PrismaService } from '../common/service/prisma.service.js';
import { ValidationService } from '../common/service/validation.service.js';
import { FileUploadService } from '../file-upload/file-upload.service.js';
import { CurrentUserRequest } from '../model/auth.model.js';
import { ESignResponse } from '../model/e-sign.model.js';
import { ActionAccessRights, ListRequest, Paging } from '../model/web.model.js';

import { CreateESignDto, UpdateESignDto } from './dto/e-sign.dto.js';
import { ESignValidation } from './e-sign.validation.js';

/**
 * Service untuk mengelola operasi E-Sign.
 * @description Menangani pembuatan, pembaruan, pengambilan, dan penghapusan E-Sign.
 */
@Injectable()
export class ESignService {
  private readonly logger = new Logger(ESignService.name);

  /**
   *
   * @param prismaService
   * @param coreHelper
   * @param fileUploadService
   * @param validationService
   */
  constructor(
    private readonly prismaService: PrismaService,
    private readonly coreHelper: CoreHelper,
    private readonly fileUploadService: FileUploadService,
    private readonly validationService: ValidationService
  ) {}

  /**
   * Membuat E-Sign baru dengan validasi dan unggah file.
   * @param request - Data untuk membuat E-Sign.
   * @param dto
   * @returns ID E-Sign yang dibuat.
   * @throws HttpException - Jika validasi gagal atau ID sudah ada.
   * @example
   * const request = { idNumber: 'EMP001', role: 'Direktur', name: 'John Doe', eSign: file, signatureType: 'SIGNATURE1', status: true };
   * await eSignService.createESign(request); // Returns '123e4567-e89b-12d3-a456-426614174000'
   */
  async createESign(dto: CreateESignDto): Promise<string> {
    this.logger.log(`Creating E-Sign for idNumber: ${dto.idNumber}`);

    // Validasi DTO dengan Zod
    const validatedDto = this.validationService.validate(
      ESignValidation.CREATE,
      dto
    );

    const totalESignWithSameIdNumber = await this.prismaService.signature.count(
      {
        where: { idNumber: validatedDto.idNumber },
      }
    );
    if (totalESignWithSameIdNumber > 0) {
      this.logger.error(`ID number already exists: ${validatedDto.idNumber}`);
      throw new HttpException(
        'No pegawai sudah digunakan',
        HttpStatus.BAD_REQUEST
      );
    }

    if (validatedDto.status) {
      const existingActiveSignature =
        await this.prismaService.signature.findFirst({
          where: { status: true, signatureType: validatedDto.signatureType },
        });
      if (existingActiveSignature) {
        this.logger.error(
          `Active signature exists for type ${validatedDto.signatureType}: ${existingActiveSignature.id}`
        );
        throw new HttpException(
          `Hanya boleh ada satu tanda tangan aktif dengan tipe ${validatedDto.signatureType}`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const { fileId } = await this.fileUploadService.uploadFile(
      validatedDto.eSign,
      validatedDto.idNumber,
      'signatures',
      false
    );

    const signature = await this.prismaService.signature.create({
      data: {
        idNumber: validatedDto.idNumber,
        role: validatedDto.role,
        name: validatedDto.name,
        eSignId: fileId,
        signatureType: validatedDto.signatureType,
        status: validatedDto.status,
      },
    });

    this.logger.log(`E-Sign created with ID: ${signature.id}`);
    return signature.id;
  }

  /**
   * Memperbarui E-Sign yang ada.
   * @param eSignId - ID E-Sign untuk diperbarui.
   * @param request - Data pembaruan.
   * @param dto
   * @returns Pesan konfirmasi pembaruan.
   * @throws HttpException - Jika E-Sign tidak ditemukan atau validasi gagal.
   * @example
   * await eSignService.updateESign('123e4567-e89b-12d3-a456-426614174000', { name: 'Jane Doe' });
   */
  async updateESign(eSignId: string, dto: UpdateESignDto): Promise<string> {
    this.logger.log(`Updating E-Sign with ID: ${eSignId}`);

    // Validasi DTO dengan Zod
    const validatedDto = this.validationService.validate(
      ESignValidation.UPDATE,
      dto
    );

    const existingESign = await this.prismaService.signature.findUnique({
      where: { id: eSignId },
    });
    if (!existingESign) {
      this.logger.error(`E-Sign not found: ${eSignId}`);
      throw new HttpException('E-Sign tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    if (
      validatedDto.idNumber &&
      validatedDto.idNumber !== existingESign.idNumber
    ) {
      const totalESignWithSameIdNumber =
        await this.prismaService.signature.count({
          where: { idNumber: validatedDto.idNumber },
        });
      if (totalESignWithSameIdNumber > 0) {
        this.logger.error(`ID number already exists: ${validatedDto.idNumber}`);
        throw new HttpException(
          'No pegawai sudah digunakan',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    if (validatedDto.status === true) {
      const signatureType =
        validatedDto.signatureType || existingESign.signatureType;
      const existingActiveSignature =
        await this.prismaService.signature.findFirst({
          where: { status: true, signatureType, id: { not: eSignId } },
        });
      if (existingActiveSignature) {
        this.logger.error(
          `Active signature exists for type ${signatureType}: ${existingActiveSignature.id}`
        );
        throw new HttpException(
          `Hanya boleh ada satu tanda tangan aktif dengan tipe ${signatureType}`,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const dataToUpdate: any = { ...validatedDto };

    if (validatedDto.eSign) {
      if (existingESign.eSignId) {
        await this.fileUploadService.deleteFile(existingESign.eSignId);
        this.logger.log(`Deleted old file with ID: ${existingESign.eSignId}`);
      }
      const { fileId } = await this.fileUploadService.uploadFile(
        validatedDto.eSign,
        validatedDto.idNumber || existingESign.idNumber,
        'signatures',
        false
      );
      dataToUpdate.eSignId = fileId;
      this.logger.log(`Uploaded new file with ID: ${fileId}`);
    }

    delete dataToUpdate.eSign;

    await this.prismaService.signature.update({
      where: { id: eSignId },
      data: dataToUpdate,
    });

    this.logger.log(`E-Sign updated: ${eSignId}`);
    return 'E-Sign berhasil diperbarui';
  }

  /**
   * Mengambil detail E-Sign berdasarkan ID.
   * @param eSignId - ID E-Sign.
   * @returns Detail E-Sign.
   * @throws HttpException - Jika E-Sign tidak ditemukan.
   */
  async getESign(eSignId: string): Promise<ESignResponse> {
    this.logger.log(`Retrieving E-Sign with ID: ${eSignId}`);

    const eSign = await this.prismaService.signature.findUnique({
      where: { id: eSignId },
      select: {
        id: true,
        idNumber: true,
        role: true,
        name: true,
        eSignId: true,
        signatureType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!eSign) {
      this.logger.error(`E-Sign not found: ${eSignId}`);
      throw new HttpException('E-Sign tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    return {
      id: eSign.id,
      idNumber: sanitizeHtml(eSign.idNumber),
      role: sanitizeHtml(eSign.role),
      name: sanitizeHtml(eSign.name),
      eSignId: eSign.eSignId ?? null,
      signatureType: eSign.signatureType,
      status: eSign.status,
      createdAt: eSign.createdAt,
      updatedAt: eSign.updatedAt,
    };
  }

  /**
   * Mengambil file E-Sign sebagai buffer.
   * @param eSignId - ID E-Sign.
   * @returns Buffer file E-Sign.
   * @throws HttpException - Jika file tidak ditemukan.
   */
  async streamFile(eSignId: string): Promise<Buffer> {
    this.logger.log(`Streaming file for E-Sign with ID: ${eSignId}`);

    const eSign = await this.prismaService.signature.findUnique({
      where: { id: eSignId },
      select: { eSignId: true },
    });

    if (!eSign || !eSign.eSignId) {
      this.logger.error(`File not found for E-Sign: ${eSignId}`);
      throw new HttpException(
        'File E-Sign tidak ditemukan',
        HttpStatus.NOT_FOUND
      );
    }

    const { buffer } = await this.fileUploadService.getFile(eSign.eSignId);
    this.logger.log(`File retrieved for E-Sign: ${eSignId}`);
    return buffer;
  }

  /**
   * Menghapus E-Sign dan file terkait.
   * @param eSignId - ID E-Sign.
   * @returns Pesan konfirmasi penghapusan.
   * @throws HttpException - Jika E-Sign tidak ditemukan.
   */
  async deleteESign(eSignId: string): Promise<string> {
    this.logger.log(`Deleting E-Sign with ID: ${eSignId}`);

    const eSign = await this.prismaService.signature.findUnique({
      where: { id: eSignId },
    });

    if (!eSign) {
      this.logger.error(`E-Sign not found: ${eSignId}`);
      throw new HttpException('E-Sign tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    if (eSign.eSignId) {
      await this.fileUploadService.deleteFile(eSign.eSignId);
      this.logger.log(`Deleted file with ID: ${eSign.eSignId}`);
    }

    await this.prismaService.signature.delete({ where: { id: eSignId } });

    this.logger.log(`E-Sign deleted: ${eSignId}`);
    return 'E-Sign berhasil dihapus';
  }

  /**
   * Mendapatkan daftar E-Sign dengan pencarian dan pagination.
   * @param request - Parameter pencarian dan pagination.
   * @param user - Informasi pengguna saat ini.
   * @returns Daftar E-Sign dengan hak akses dan pagination.
   * @example
   * await eSignService.listESign({ searchQuery: 'john', page: 1, size: 10 }, user);
   */
  async listESign(
    request: ListRequest,
    user: CurrentUserRequest
  ): Promise<{
    data: ESignResponse[];
    actions: ActionAccessRights;
    paging: Paging;
  }> {
    this.logger.log(`Listing E-Signs for user: ${user.email}`);

    const whereClause: any = {};
    if (request.search) {
      const sanitizedQuery = sanitizeHtml(request.search);
      whereClause.OR = [
        { idNumber: { contains: sanitizedQuery, mode: 'insensitive' } },
        { role: { contains: sanitizedQuery, mode: 'insensitive' } },
        { name: { contains: sanitizedQuery, mode: 'insensitive' } },
      ];
    }

    const totalESign = await this.prismaService.signature.count({
      where: whereClause,
    });

    const page = request.page ?? 1;
    const size = request.size ?? 10;
    const skip = (page - 1) * size;

    const eSigns = await this.prismaService.signature.findMany({
      where: whereClause,
      select: {
        id: true,
        idNumber: true,
        role: true,
        name: true,
        eSignId: true,
        signatureType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      skip,
      take: size,
    });

    const totalPage = Math.ceil(totalESign / size);
    const userRole = user.role.name.toLowerCase();
    const accessRights = this.validateActions(userRole);

    this.logger.log(`Retrieved ${eSigns.length} E-Signs for page ${page}`);
    return {
      data: eSigns.map(eSign => ({
        id: eSign.id,
        idNumber: sanitizeHtml(eSign.idNumber),
        role: sanitizeHtml(eSign.role),
        name: sanitizeHtml(eSign.name),
        eSignId: eSign.eSignId ?? null,
        signatureType: eSign.signatureType,
        status: eSign.status,
        createdAt: eSign.createdAt,
        updatedAt: eSign.updatedAt,
      })),
      actions: accessRights,
      paging: {
        currentPage: page,
        totalPage,
        size,
        totalItems: totalESign,
      },
    };
  }

  /**
   * Menentukan hak akses berdasarkan peran pengguna.
   * @param userRole - Peran pengguna (contoh: 'super admin').
   * @returns Hak akses untuk edit, delete, dan view.
   */
  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canEdit: true, canDelete: true, canView: true },
      supervisor: { canEdit: false, canDelete: false, canView: true },
    };

    return this.coreHelper.validateActions(userRole, accessMap);
  }
}