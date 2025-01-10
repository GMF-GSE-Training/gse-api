import { HttpException, Injectable } from '@nestjs/common';
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

@Injectable()
export class ESignService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly coreHelper: CoreHelper,
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

    await this.prismaService.signature.create({
      data: createRequest,
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

    await this.prismaService.signature.update({
      where: {
        id: eSignId,
      },
      data: updateRequest,
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

    if (!eSign || !eSign.eSign) {
      throw new HttpException('File E-Sign tidak ditemukan', 404);
    }

    return eSign.eSign;
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

    const totalESign = await this.prismaService.signature.count({
      where: whereClause,
    });

    const eSign = await this.prismaService.signature.findMany({
      where: whereClause,
      select: {
        id: true,
        idNumber: true,
        role: true,
        name: true,
        signatureType: true,
        status: true,
      },
      skip: (request.page - 1) * request.size,
      take: request.size,
    });

    const mappedESign = eSign.map((item) => ({
      ...item,
      signatureType: item.signatureType as SignatureType, // Explicitly cast to your enum type
    }));

    const totalPage = Math.ceil(totalESign / request.size);

    const userRole = user.role.name.toLowerCase();
    const accessRights = this.validateActions(userRole);

    return {
      data: mappedESign,
      actions: accessRights,
      paging: {
        currentPage: request.page,
        totalPage: totalPage,
        size: request.size,
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
