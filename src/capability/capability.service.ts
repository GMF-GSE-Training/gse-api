import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import {
  CapabilityResponse,
  CreateCapability,
  UpdateCapability,
} from 'src/model/capability.model';
import { CapabilityValidation } from './capability.validation';
import { ActionAccessRights, ListRequest, Paging } from 'src/model/web.model';
import { CurrentUserRequest } from 'src/model/auth.model';
import { CoreHelper } from 'src/common/helpers/core.helper';
import { naturalSort } from '../common/helpers/natural-sort';

@Injectable()
export class CapabilityService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly coreHelper: CoreHelper,
  ) {}

  async createCapability(
    request: CreateCapability,
  ): Promise<CapabilityResponse> {
    const createCapabilityRequest = this.validationService.validate(
      CapabilityValidation.CREATE,
      request,
    );

    await this.coreHelper.ensureUniqueFields('capability', [
      {
        field: 'ratingCode',
        value: createCapabilityRequest.ratingCode,
        message: 'Kode Rating sudah ada',
      },
      {
        field: 'trainingCode',
        value: createCapabilityRequest.trainingCode,
        message: 'Kode Training sudah ada',
      },
      {
        field: 'trainingName',
        value: createCapabilityRequest.trainingName,
        message: 'Nama Training sudah ada',
      },
    ]);

    const capability = await this.prismaService.capability.create({
      data: createCapabilityRequest,
    });

    const {
      totalTheoryDurationRegGse,
      totalPracticeDurationRegGse,
      totalTheoryDurationCompetency,
      totalPracticeDurationCompetency,
      totalDuration,
      ...result
    } = capability;

    return result;
  }

  async getCapabilityById(capabilityId: string): Promise<CapabilityResponse> {
    const capability = await this.prismaService.capability.findUnique({
      where: {
        id: capabilityId,
      },
      select: {
        id: true,
        ratingCode: true,
        trainingCode: true,
        trainingName: true,
      },
    });

    if (!capability) {
      throw new HttpException('Capability Not Found', 404);
    }

    return capability;
  }

  async getCurriculumSyllabus(
    capabilityId: string,
  ): Promise<CapabilityResponse> {
    const capability = await this.prismaService.capability.findUnique({
      where: {
        id: capabilityId,
      },
      select: {
        id: true,
        ratingCode: true,
        trainingCode: true,
        trainingName: true,
        curriculumSyllabus: true,
      },
    });

    if (!capability) {
      throw new HttpException('Capability Not Found', 404);
    }

    return capability;
  }

  async updateCapability(
    capabilityId: string,
    req: UpdateCapability,
  ): Promise<string> {
    const updateCapabilityRequest = this.validationService.validate(
      CapabilityValidation.UPDATE,
      req,
    );

    const capability = await this.prismaService.capability.findUnique({
      where: {
        id: capabilityId,
      },
    });

    if (!capability) {
      throw new HttpException('Capability tidak ditemukan', 404);
    }

    await this.coreHelper.ensureUniqueFields(
      'capability',
      [
        {
          field: 'ratingCode',
          value: updateCapabilityRequest.ratingCode,
          message: 'Kode Rating sudah ada',
        },
        {
          field: 'trainingCode',
          value: updateCapabilityRequest.trainingCode,
          message: 'Kode Training sudah ada',
        },
        {
          field: 'trainingName',
          value: updateCapabilityRequest.trainingName,
          message: 'Nama Training sudah ada',
        },
      ],
      capabilityId,
    );

    await this.prismaService.capability.update({
      where: {
        id: capability.id,
      },
      data: updateCapabilityRequest,
    });

    return 'Capability berhasil diperbarui';
  }

  async deleteCapability(capabilityId: string): Promise<string> {
    const capability = await this.prismaService.capability.findUnique({
      where: {
        id: capabilityId,
      },
    });

    if (!capability) {
      throw new HttpException('Capability tidak ditemukan', 404);
    }

    await this.prismaService.$transaction(async (prisma) => {
      // Hapus curriculumSyllabus terkait capabilityId
      await prisma.curriculumSyllabus.deleteMany({
        where: {
          capabilityId: capabilityId,
        },
      });

      // Hapus capability
      await prisma.capability.delete({
        where: {
          id: capabilityId,
        },
      });
    });

    return 'Capability berhasil dihapus';
  }

  async getAllCapability(): Promise<CapabilityResponse[]> {
    const capability = await this.prismaService.capability.findMany();
    return capability.map((item) => ({
      id: item.id,
      ratingCode: item.ratingCode,
      trainingCode: item.trainingCode,
      trainingName: item.trainingName,
    }));
  }

  async listCapability(
    user: CurrentUserRequest,
    request: ListRequest,
  ): Promise<{
    data: CapabilityResponse[];
    actions: ActionAccessRights;
    paging: Paging;
  }> {
    const whereClause: any = {};
    if (request.searchQuery) {
      const searchQuery = request.searchQuery;
      whereClause.OR = [
        { ratingCode: { contains: searchQuery, mode: 'insensitive' } },
        { trainingCode: { contains: searchQuery, mode: 'insensitive' } },
        { trainingName: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Hitung total untuk pagination
    const totalCapability = await this.prismaService.capability.count({
      where: whereClause,
    });

    // Pagination parameters
    const page = request.page || 1;
    const size = request.size || 10;
    const totalPage = Math.ceil(totalCapability / size);

    // Hybrid sorting: whitelist field DB dan computed
    const allowedSortFields = [
      'ratingCode',
      'trainingCode',
      'trainingName',
      'id',
      'durasiMateriRegulasiGSE',
      'durasiMateriKompetensi',
      'totalDuration',
    ];
    const naturalSortFields = ['ratingCode', 'trainingCode', 'trainingName'];
    const computedFields = ['durasiMateriRegulasiGSE', 'durasiMateriKompetensi', 'totalDuration'];
    const dbSortFields = ['ratingCode', 'trainingCode', 'trainingName', 'id'];
    
    let sortBy = request.sortBy && allowedSortFields.includes(request.sortBy) ? request.sortBy : 'ratingCode';
    let sortOrder: "asc" | "desc" = request.sortOrder === 'desc' ? 'desc' : 'asc';

    let capabilities: any[];
    
    // Optimasi: Strategi berbeda berdasarkan field type
    if (naturalSortFields.includes(sortBy)) {
      // Untuk field yang perlu natural sort, ambil semua data dulu
      capabilities = await this.prismaService.capability.findMany({
        where: whereClause,
      });
      capabilities.sort((a, b) => naturalSort(a[sortBy] || '', b[sortBy] || '', sortOrder));
      // Pagination manual setelah sorting
      capabilities = capabilities.slice((page - 1) * size, page * size);
    } else if (computedFields.includes(sortBy)) {
      // Untuk computed fields, ambil semua data dulu
      capabilities = await this.prismaService.capability.findMany({
        where: whereClause,
      });
      // Mapping ke computed field
      const capabilitiesWithFilteredAttributes = capabilities.map(this.mapCapabilityWithDurations);
      // Sort manual untuk computed fields
      const sortedData = [...capabilitiesWithFilteredAttributes].sort((a, b) => {
        let aValue: number = 0;
        let bValue: number = 0;
        if (sortBy === 'durasiMateriRegulasiGSE') {
          aValue = a.totalMaterialDurationRegGse || 0;
          bValue = b.totalMaterialDurationRegGse || 0;
        } else if (sortBy === 'durasiMateriKompetensi') {
          aValue = a.totalMaterialDurationCompetency || 0;
          bValue = b.totalMaterialDurationCompetency || 0;
        } else if (sortBy === 'totalDuration') {
          aValue = (a.totalMaterialDurationRegGse || 0) + (a.totalMaterialDurationCompetency || 0);
          bValue = (b.totalMaterialDurationRegGse || 0) + (b.totalMaterialDurationCompetency || 0);
        }
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });
      // Pagination manual setelah sorting
      capabilities = sortedData.slice((page - 1) * size, page * size);
    } else {
      // Untuk field biasa, gunakan DB sorting dan pagination
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;
      capabilities = await this.prismaService.capability.findMany({
        where: whereClause,
        orderBy,
        skip: (page - 1) * size,
        take: size,
      });
    }

    // Mapping ke computed field untuk response
    const capabilitiesWithFilteredAttributes = capabilities.map(this.mapCapabilityWithDurations);

    const userRole = user.role.name.toLowerCase();
    const actions = this.validateActions(userRole);

    return {
      data: capabilitiesWithFilteredAttributes,
      actions: actions,
      paging: {
        currentPage: page,
        totalPage: totalPage,
        size: size,
      },
    };
  }

  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canEdit: true, canDelete: true },
      supervisor: { canEdit: false, canDelete: false },
      lcu: { canEdit: false, canDelete: false },
      user: { canEdit: false, canDelete: false },
    };

    return this.coreHelper.validateActions(userRole, accessMap);
  }

  private mapCapabilityWithDurations(capability: any): any {
    const {
      totalTheoryDurationRegGse,
      totalPracticeDurationRegGse,
      totalTheoryDurationCompetency,
      totalPracticeDurationCompetency,
      ...rest
    } = capability;

    const totalMaterialDurationRegGse =
      (totalTheoryDurationRegGse || 0) + (totalPracticeDurationRegGse || 0);
    const totalMaterialDurationCompetency =
      (totalTheoryDurationCompetency || 0) +
      (totalPracticeDurationCompetency || 0);

    return {
      ...rest,
      totalMaterialDurationRegGse, // durasiMateriRegulasiGSE di FE
      totalMaterialDurationCompetency, // durasiMateriKompetensi di FE
    };
  }
}
