import { HttpException, Injectable } from '@nestjs/common';

import { CoreHelper } from '../common/helpers/core.helper.js';
import { PrismaService } from '../common/service/prisma.service.js';
import { ValidationService } from '../common/service/validation.service.js';
import { CurrentUserRequest } from '../model/auth.model.js';
import {
  CapabilityResponse,
  CreateCapability,
  UpdateCapability,
} from '../model/capability.model.js';
import { ActionAccessRights, ListRequest, Paging } from '../model/web.model.js';

import { CapabilityValidation } from './capability.validation.js';

/**
 *
 */
@Injectable()
export class CapabilityService {
  /**
   *
   * @param prismaService
   * @param validationService
   * @param coreHelper
   */
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly coreHelper: CoreHelper
  ) {}

  /**
   *
   * @param request
   */
  async createCapability(
    request: CreateCapability
  ): Promise<CapabilityResponse> {
    const createCapabilityRequest = this.validationService.validate(
      CapabilityValidation.CREATE,
      request
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

  /**
   *
   * @param capabilityId
   */
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!capability) {
      throw new HttpException('Capability Not Found', 404);
    }

    return capability;
  }

  /**
   *
   * @param capabilityId
   */
  async getCurriculumSyllabus(
    capabilityId: string
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!capability) {
      throw new HttpException('Capability Not Found', 404);
    }

    return capability;
  }

  /**
   *
   * @param capabilityId
   * @param req
   */
  async updateCapability(
    capabilityId: string,
    req: UpdateCapability
  ): Promise<string> {
    const updateCapabilityRequest = this.validationService.validate(
      CapabilityValidation.UPDATE,
      req
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
      capabilityId
    );

    await this.prismaService.capability.update({
      where: {
        id: capability.id,
      },
      data: updateCapabilityRequest,
    });

    return 'Capability berhasil diperbarui';
  }

  /**
   *
   * @param capabilityId
   */
  async deleteCapability(capabilityId: string): Promise<string> {
    const capability = await this.prismaService.capability.findUnique({
      where: {
        id: capabilityId,
      },
    });

    if (!capability) {
      throw new HttpException('Capability tidak ditemukan', 404);
    }

    await this.prismaService.$transaction(async prisma => {
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

  /**
   *
   */
  async getAllCapability(): Promise<CapabilityResponse[]> {
    const capability = await this.prismaService.capability.findMany();
    return capability.map(item => ({
      id: item.id,
      ratingCode: item.ratingCode,
      trainingCode: item.trainingCode,
      trainingName: item.trainingName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  /**
   *
   * @param user
   * @param request
   */
  async listCapability(
    user: CurrentUserRequest,
    request: ListRequest
  ): Promise<{
    data: CapabilityResponse[];
    actions: ActionAccessRights;
    paging: Paging;
  }> {
    const whereClause: any = {};
    if (request.search) {
      const searchQuery = request.search;
      whereClause.OR = [
        { ratingCode: { contains: searchQuery, mode: 'insensitive' } },
        { trainingCode: { contains: searchQuery, mode: 'insensitive' } },
        { trainingName: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    const page = request.page ?? 1;
    const size = request.size ?? 10;
    const skip = (page - 1) * size;

    const totalCapability = await this.prismaService.capability.count({
      where: whereClause,
    });

    const capabilities = await this.prismaService.capability.findMany({
      where: whereClause,
      skip,
      take: size,
    });

    const capabilitiesWithFilteredAttributes = capabilities.map(item => ({
      id: item.id,
      ratingCode: item.ratingCode,
      trainingCode: item.trainingCode,
      trainingName: item.trainingName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const totalPage = Math.ceil(totalCapability / size);

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

  /**
   *
   * @param userRole
   */
  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canEdit: true, canDelete: true },
      supervisor: { canEdit: false, canDelete: false },
      lcu: { canEdit: false, canDelete: false },
      user: { canEdit: false, canDelete: false },
    };

    return this.coreHelper.validateActions(userRole, accessMap);
  }

  /**
   *
   * @param capability
   */
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
      totalMaterialDurationRegGse,
      totalMaterialDurationCompetency,
    };
  }
}
