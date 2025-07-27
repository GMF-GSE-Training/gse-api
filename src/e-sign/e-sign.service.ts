import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import {
  CreateESign,
  ESignResponse,
  SignatureType,
  UpdateESign,
} from 'src/model/e-sign.model';
import { ESignValidation } from './e-sign.validation';
import { ActionAccessRights, ListRequest, Paging } from 'src/model/web.model';
import { CoreHelper } from 'src/common/helpers/core.helper';
import { CurrentUserRequest } from 'src/model/auth.model';
import { getFileBufferFromMinio } from '../common/helpers/minio.helper';
import { FileUploadService } from '../file-upload/file-upload.service';
import { naturalSort } from '../common/helpers/natural-sort';
import { SortingHelper, SortingConfigBuilder } from '../common/helpers/sorting.helper';

@Injectable()
export class ESignService {
  private readonly logger = new Logger(ESignService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly coreHelper: CoreHelper,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async createESign(request: CreateESign): Promise<string> {
    const createRequest = this.validationService.validate(
      ESignValidation.CREATE,
      request,
    );

    if (!Object.values(SignatureType).includes(createRequest.signatureType)) {
      throw new HttpException('Tipe tanda tangan tidak valid', 400);
    }

    const totalESingWithSameIdNumber = await this.prismaService.signature.count(
      {
        where: {
          idNumber: createRequest.idNumber,
        },
      },
    );

    if (totalESingWithSameIdNumber != 0) {
      throw new HttpException('No pegawai sudah digunakan', 400);
    }

    // Validasi status dan signatureType
    if (createRequest.status === true) {
      const existingActiveSignature =
        await this.prismaService.signature.findFirst({
          where: {
            status: true,
            signatureType: createRequest.signatureType,
          },
        });

      if (existingActiveSignature) {
        throw new HttpException(
          `Hanya boleh ada satu tanda tangan aktif dengan tipe ${createRequest.signatureType}`,
          400,
        );
      }
    }

    // Upload file eSign jika ada
    if (createRequest.eSign) {
      try {
          this.logger.log(`Uploading eSign file for signature...`);
          const fileObj = {
              buffer: createRequest.eSign,
              originalname: `esign/${createRequest.eSignFileName}` || `esign/esign_${createRequest.idNumber}.jpg`,
              mimetype: 'application/octet-stream',
              size: createRequest.eSign.length,
          };
          
          const path = await this.fileUploadService.uploadFile(fileObj as any, fileObj.originalname);
          createRequest.eSignPath = path;
          this.logger.log(`eSign file uploaded, path: ${path}`);
      } catch (err) {
          this.logger.error(`Gagal upload eSign file: ${err.message}`);
          throw new HttpException(`Gagal upload eSign file: ${err.message}`, 500);
      }
    }

    await this.prismaService.signature.create({
      data: {
          idNumber: createRequest.idNumber,
          role: createRequest.role,
          name: createRequest.name,
          eSignPath: createRequest.eSignPath,
          eSignFileName: createRequest.eSignFileName,
          signatureType: createRequest.signatureType,
          status: createRequest.status,
      },
  });

    return 'E-Sign berhasil ditambahkan';
  }

  async updateESign(eSignId: string, request: UpdateESign): Promise<string> {
    const updateRequest = this.validationService.validate(
      ESignValidation.UPDATE,
      request,
    );

    if (updateRequest.signatureType) {
      if (!Object.values(SignatureType).includes(updateRequest.signatureType)) {
        throw new HttpException('Tipe tanda tangan tidak valid', 400);
      }
    }

    if (updateRequest.idNumber) {
      const totalESingWithSameIdNumber =
        await this.prismaService.signature.count({
          where: {
            idNumber: updateRequest.idNumber,
          },
        });

      if (totalESingWithSameIdNumber > 1) {
        throw new HttpException('No pegawai sudah digunakan', 400);
      }
    }

    // Validasi status dan signatureType
    if (updateRequest.status) {
      if (updateRequest.status === true) {
        const existingActiveSignature =
          await this.prismaService.signature.count({
            where: {
              status: true,
              signatureType: updateRequest.signatureType,
            },
          });

        if (existingActiveSignature > 1) {
          throw new HttpException(
            `Hanya boleh ada satu tanda tangan aktif dengan tipe ${updateRequest.signatureType}`,
            400,
          );
        }
      }
    }

    // Upload file eSign jika ada
    if (updateRequest.eSign) {
      try {
          this.logger.log(`Uploading eSign file for signature...`);
          const fileObj = {
              buffer: updateRequest.eSign,
              originalname: updateRequest.eSignFileName || `esign_${updateRequest.idNumber}.jpg`,
              mimetype: 'application/octet-stream',
              size: updateRequest.eSign.length,
          };
          
          const path = await this.fileUploadService.uploadFile(fileObj as any, fileObj.originalname);
          updateRequest.eSignPath = path;
          this.logger.log(`eSign file uploaded, path: ${path}`);
      } catch (err) {
          this.logger.error(`Gagal upload eSign file: ${err.message}`);
          throw new HttpException(`Gagal upload eSign file: ${err.message}`, 500);
      }
    }

    await this.prismaService.signature.update({
      where: {
        id: eSignId,
      },
      data: {
        idNumber: updateRequest.idNumber,
        role: updateRequest.role,
        name: updateRequest.name,
        eSignPath: updateRequest.eSignPath,
        eSignFileName: updateRequest.eSignFileName,
        signatureType: updateRequest.signatureType,
        status: updateRequest.status,
      },
    });

    return 'E-Sign berhasil diperbari';
  }

  async getESign(eSignId: string): Promise<any> {
    const eSign = await this.prismaService.signature.findUnique({
      where: {
        id: eSignId,
      },
      select: {
        id: true,
        idNumber: true,
        role: true,
        name: true,
        eSignFileName: true,
        signatureType: true,
        status: true,
      },
    });

    if (!eSign) {
      throw new HttpException('E-Sign tidak ditemukan', 404);
    }

    return eSign;
  }

  async streamFile(eSignId: string): Promise<Buffer> {
    const eSign = await this.prismaService.signature.findUnique({
      where: {
        id: eSignId,
      },
    });

    if (!eSign || !eSign.eSignPath) {
      throw new HttpException('File E-Sign tidak ditemukan', 404);
    }

    // Ambil file dari storage dinamis (satu jalur)
    try {
      const { buffer } = await this.fileUploadService.downloadFile(eSign.eSignPath);
      return buffer;
    } catch (err: any) {
      if (err.status === 404) {
        throw new HttpException('File E-Sign tidak ditemukan', 404);
      }
      throw new HttpException('Gagal mengambil file E-Sign: ' + (err.message || err), 500);
    }
  }

  async deleteESign(eSignId: string): Promise<string> {
    const eSign = await this.prismaService.signature.findUnique({
      where: {
        id: eSignId,
      },
    });

    if (!eSign) {
      throw new HttpException('E-Sign tidak ditemukan', 404);
    }

    await this.prismaService.signature.delete({
      where: {
        id: eSign.id,
      },
    });

    return 'E-Sign berhadil dihapus';
  }

  async listESign(
    request: ListRequest,
    user: CurrentUserRequest,
  ): Promise<{
    data: ESignResponse[];
    actions: ActionAccessRights;
    paging: Paging;
  }> {
    const whereClause: any = {};
    if (request.searchQuery) {
      const searchQuery = request.searchQuery;
      whereClause.OR = [
        { idNumber: { contains: searchQuery, mode: 'insensitive' } },
        { role: { contains: searchQuery, mode: 'insensitive' } },
        { name: { contains: searchQuery, mode: 'insensitive' } },
      ];
      console.log(searchQuery);
    }

    // Hitung total untuk pagination
    const totalESign = await this.prismaService.signature.count({
      where: whereClause,
    });

    // Pagination parameters
    const page = request.page || 1;
    const size = request.size || 10;
    const totalPage = Math.ceil(totalESign / size);

    // Configurasi sorting yang sesuai dengan kolom yang ada di tabel signatures
    const sortingConfig = SortingConfigBuilder
      .create()
      .allowFields(['idNumber', 'role', 'name', 'signatureType', 'status', 'id'])
      .naturalSort(['idNumber', 'role', 'name']) // String fields for natural sorting
      .databaseSort(['signatureType', 'status', 'id']) // Fields that can be sorted in DB
      .defaultSort('idNumber')
      .build();
    
    // Validasi dan normalisasi sorting parameters
    const { sortBy, sortOrder, strategy } = SortingHelper.validateAndNormalizeSorting(
      request.sortBy,
      request.sortOrder,
      sortingConfig
    );
    
    // Optimasi: Strategi berbeda berdasarkan field type
    let eSign: any[];
    
    const selectFields = {
      id: true,
      idNumber: true,
      role: true,
      name: true,
      signatureType: true,
      status: true,
    };
    
    if (strategy === 'natural' || strategy === 'fallback') {
      // Natural sort global: ambil seluruh data, sort, lalu pagination manual
      const allESign = await this.prismaService.signature.findMany({
        where: whereClause,
        select: selectFields,
      });
      eSign = SortingHelper.sortArrayNaturally(allESign, sortBy, sortOrder)
        .slice((page - 1) * size, page * size);
    } else if (strategy === 'database') {
      // Database sorting
      const orderBy = SortingHelper.createPrismaOrderBy(sortBy, sortOrder);
      eSign = await this.prismaService.signature.findMany({
        where: whereClause,
        select: selectFields,
        orderBy,
        skip: (page - 1) * size,
        take: size,
      });
    } else {
      // Fallback: natural sort
      const allESign = await this.prismaService.signature.findMany({
        where: whereClause,
        select: selectFields,
      });
      eSign = SortingHelper.sortArrayNaturally(allESign, sortBy, sortOrder)
        .slice((page - 1) * size, page * size);
    }

    const mappedESign = eSign.map((item) => ({
      ...item,
      signatureType: item.signatureType as SignatureType, // Explicitly cast to your enum type
    }));

    const userRole = user.role.name.toLowerCase();
    const accessRights = this.validateActions(userRole);

    return {
      data: mappedESign,
      actions: accessRights,
      paging: {
        currentPage: page,
        totalPage: totalPage,
        size: size,
      },
    };
  }

  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canEdit: true, canDelete: true, canView: true },
      supervisor: { canEdit: false, canDelete: false, canView: true },
    };

    return this.coreHelper.validateActions(userRole, accessMap);
  }
}
