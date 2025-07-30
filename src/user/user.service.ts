import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/service/prisma.service';
import { ValidationService } from '../common/service/validation.service';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from '../model/user.model';
import { UserValidation } from './user.validation';
import * as bcrypt from 'bcrypt';
import { ActionAccessRights, ListRequest, Paging } from 'src/model/web.model';
import { CurrentUserRequest } from 'src/model/auth.model';
import { CoreHelper } from 'src/common/helpers/core.helper';
import { RoleResponse } from 'src/model/role.model';
import { Logger } from '@nestjs/common';
import { naturalSort } from '../common/helpers/natural-sort';
import { SortingHelper, SortingConfigBuilder } from '../common/helpers/sorting.helper';
import { EnhancedSearchHelper, EnhancedSearchConfig } from '../common/helpers/enhanced-search.helper';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly validationService: ValidationService,
    private readonly prismaService: PrismaService,
    private readonly coreHelper: CoreHelper,
  ) {}

  async createUser(
    req: CreateUserRequest,
    user: CurrentUserRequest,
  ): Promise<string> {
    for (const key in req) {
      if (req.hasOwnProperty(key)) {
        req[key] = this.coreHelper.transformEmptyToNull(req[key]);
      }
    }
    const createRequest: CreateUserRequest = this.validationService.validate(
      UserValidation.CREATE,
      req,
    );

    createRequest.dinas
      ? createRequest.dinas.toUpperCase()
      : createRequest.dinas;

    await this.coreHelper.ensureUniqueFields('user', [
      {
        field: 'idNumber',
        value: createRequest.idNumber,
        message: 'No pegawai sudah digunakan',
      },
      {
        field: 'email',
        value: createRequest.email,
        message: 'Email sudah digunakan',
      },
    ]);

    const userRole = user.role.name.toLowerCase();
    const roleUser = await this.findRoleUser();

    const role = await this.prismaService.role.findUnique({
      where: {
        id: createRequest.roleId,
      },
    });

    if (!role) {
      throw new HttpException('Role tidak valid', 400);
    }

    const roleRequest = role.name.toLowerCase();

    if (roleRequest === 'user') {
      if (createRequest.participantId) {
        const participant = await this.prismaService.participant.findFirst({
          where: {
            id: createRequest.participantId,
          },
        });

        if (!participant) {
          throw new HttpException('Participant tidak ditemukan', 404);
        }
      }
      this.validateNikForUser(createRequest);
      await this.validateParticipantByNik(createRequest);
    } else if (roleRequest === 'lcu') {
      this.validateNikForNonUserRoles(createRequest.nik);
      this.validateDinas(createRequest.dinas, roleRequest);
    } else if (roleRequest === 'supervisor') {
      this.validateNikForNonUserRoles(createRequest.nik);
      this.validateDinas(createRequest.dinas, roleRequest);
    } else {
      this.validateNikForNonUserRoles(createRequest.nik);
      this.validateDinasForSuperAdmin(createRequest.dinas);
    }

    if (userRole === 'lcu') {
      this.validateRoleForLcuOrSupervisorRequest(
        createRequest.roleId,
        roleUser.id,
      );
      this.validateDinasForLcuRequest(createRequest.dinas, user.dinas);
    } else if (userRole === 'supervisor') {
      this.validateRoleForLcuOrSupervisorRequest(
        createRequest.roleId,
        roleUser.id,
      );
    }

    createRequest.password = await bcrypt.hash(createRequest.password, 10);

    const userSelectFields = this.userSelectFields();

    await this.prismaService.user.create({
      data: {
        ...createRequest,
        verifiedAccount: true,
      },
      select: userSelectFields,
    });

    return 'User berhasil dibuat';
  }

  async getUser(userId: string): Promise<UserResponse> {
    const findUser = await this.findUser(userId);
    if (!findUser) {
      throw new HttpException('User tidak ditemukan', 404);
    }

    const result: UserResponse = {
      ...findUser,
    };

    return this.toUserResponse(result);
  }

  async updateUser(
    userId: string,
    req: UpdateUserRequest,
    user: CurrentUserRequest,
  ): Promise<string> {
    for (const key in req) {
      if (req.hasOwnProperty(key)) {
        req[key] = this.coreHelper.transformEmptyToNull(req[key]);
      }
    }

    const updateRequest: UpdateUserRequest = this.validationService.validate(
      UserValidation.UPDATE,
      req,
    );

    const findUser = await this.findUser(userId);

    if (!findUser) {
      throw new HttpException('User tidak ditemukan', 404);
    }

    const roleUser = await this.findRoleUser();
    const userRole = user.role.name.toLowerCase();

    if (userRole === 'supervisor') {
      if (updateRequest.roleId) {
        this.validateRoleForLcuOrSupervisorRequest(
          updateRequest.roleId,
          roleUser.id,
        );
      }
    }

    if (userRole !== 'super admin' && updateRequest.email) {
      throw new HttpException('Anda tidak bisa mengubah email pengguna', 400);
    }

    const role = await this.prismaService.role.findUnique({
      where: {
        id: updateRequest.roleId,
      },
    });

    if (!role) {
      throw new HttpException('Role tidak valid', 400);
    }

    const roleRequest = role.name.toLowerCase();

    if (roleRequest === 'user') {
      this.validateNikForUser(updateRequest);
    } else if (roleRequest === 'lcu') {
      this.validateNikForNonUserRoles(updateRequest.nik);
      this.validateDinas(updateRequest.dinas, roleRequest);
    } else if (roleRequest === 'supervisor') {
      this.validateNikForNonUserRoles(updateRequest.nik);
      this.validateDinas(updateRequest.dinas, roleRequest);
    } else {
      this.validateNikForNonUserRoles(updateRequest.nik);
      this.validateDinasForSuperAdmin(updateRequest.dinas);
    }

    for (const key of Object.keys(updateRequest)) {
      if (updateRequest[key] !== undefined) {
        if (key === 'password') {
          updateRequest.password = await bcrypt.hash(
            updateRequest.password,
            10,
          );
        } else {
          (updateRequest as any)[key] = updateRequest[key];
        }
      }
    }

    const userSelectFields = this.userSelectFields();

    await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: updateRequest,
      select: userSelectFields,
    });

    if (findUser.nik) {
      const updateParticipant = {
        idNumber: updateRequest.idNumber,
        name: updateRequest.name,
        nik: updateRequest.nik,
        dinas: updateRequest.dinas,
        email: updateRequest.email,
      };

      const participantUpdate = await this.prismaService.participant.findFirst({
        where: {
          nik: findUser.nik,
        },
      });

      if (participantUpdate) {
        await this.prismaService.participant.update({
          where: {
            id: participantUpdate.id,
          },
          data: updateParticipant,
        });
      }
    }

    return 'User berhasil diperbarui';
  }

  async delete(userId: string): Promise<string> {
    this.logger.log(`Memulai penghapusan user dengan ID: ${userId}`);
    const findUser = await this.findUser(userId);

    if (!findUser) {
      this.logger.warn(`User dengan ID ${userId} tidak ditemukan.`);
      throw new HttpException('User tidak ditemukan', 404);
    }

    try {
      await this.prismaService.$transaction(async (prisma) => {
        this.logger.debug(`Memulai transaksi penghapusan untuk user ${userId}.`);
        // Hapus participant terkait jika ada
        if (findUser.participantId) {
          this.logger.debug(`User ${userId} memiliki participantId: ${findUser.participantId}. Menghapus participant terkait.`);
          const deletedParticipant = await prisma.participant.delete({
            where: { id: findUser.participantId }
          });
          this.logger.debug(`Participant ${findUser.participantId} berhasil dihapus. Hasil: ${JSON.stringify(deletedParticipant)}`);
        }

        // Kemudian hapus user
        const deletedUser = await prisma.user.delete({
          where: {
            id: userId,
          },
        });
        this.logger.debug(`User ${userId} berhasil dihapus. Hasil: ${JSON.stringify(deletedUser)}`);
      });
      this.logger.log(`Penghapusan user ${userId} dan data terkait berhasil.`);
      return 'User berhasil dihapus';
    } catch (error) {
      this.logger.error(`Gagal menghapus user ${userId} atau participant terkait: ${error.message}`, error.stack);
      throw new HttpException('Gagal menghapus user atau data terkait', 500);
    }
  }

  async listUsers(
    request: ListRequest,
    user: CurrentUserRequest,
  ): Promise<{
    data: UserResponse[];
    actions: ActionAccessRights;
    paging: Paging;
  }> {
    const userSelectFields = this.userSelectFields();
    let whereCondition: any = {};

    // Enhanced search implementation
    const searchQuery = request.searchQuery;
    if (searchQuery) {
      const searchConfig: EnhancedSearchConfig = {
        textFields: ['idNumber', 'email', 'name', 'dinas'],
        dateFields: [],
      };

      const searchClause = EnhancedSearchHelper.buildEnhancedSearchClause(searchQuery, searchConfig);
      if (Object.keys(searchClause).length > 0) {
        whereCondition = searchClause;
      } else {
        // Fallback to simple search
        whereCondition = {
          OR: [
            { idNumber: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } },
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { dinas: { contains: searchQuery, mode: 'insensitive' } },
            { role: { name: { contains: searchQuery, mode: 'insensitive' } } },
          ],
        };
      }
    }

    // Count total for pagination
    const totalUsers = await this.prismaService.user.count({ where: whereCondition });

    // Pagination parameters
    const page = request.page || 1;
    const size = request.size || 10;
    const totalPage = Math.ceil(totalUsers / size);

    // Sorting configuration using available API
    const sortingConfig = SortingConfigBuilder
      .create()
      .allowFields(['idNumber', 'email', 'name', 'dinas', 'id', 'roleName'])
      .naturalSort(['idNumber', 'email', 'name', 'dinas'])
      .databaseSort(['id'])
      .relationSort(['roleName'])
      .defaultSort('idNumber')
      .build();

    const sortResult = SortingHelper.validateAndNormalizeSorting(
      request.sortBy,
      request.sortOrder,
      sortingConfig,
      searchQuery
    );

    let users: any[];

    // Handle sorting based on strategy
    if (sortResult.strategy === 'natural' || sortResult.strategy === 'fallback') {
      // For natural sorting, get all data then sort and paginate
      const allUsers = await this.prismaService.user.findMany({
        where: whereCondition,
        select: {
          ...userSelectFields,
          role: { select: { name: true } },
        },
      });
      
      const sortedUsers = SortingHelper.sortArrayNaturally(allUsers, sortResult.sortBy, sortResult.sortOrder);
      users = sortedUsers.slice((page - 1) * size, page * size);
    } else if (sortResult.sortBy === 'roleName') {
      // Handle role relation sorting
      users = await this.prismaService.user.findMany({
        where: whereCondition,
        select: {
          ...userSelectFields,
          role: { select: { name: true } },
        },
        orderBy: { role: { name: sortResult.sortOrder } },
        skip: (page - 1) * size,
        take: size,
      });
    } else {
      // Database sorting
      const orderBy = SortingHelper.createPrismaOrderBy(sortResult.sortBy, sortResult.sortOrder);
      users = await this.prismaService.user.findMany({
        where: whereCondition,
        select: {
          ...userSelectFields,
          role: { select: { name: true } },
        },
        orderBy,
        skip: (page - 1) * size,
        take: size,
      });
    }

    // Get actions based on user role
    const userRole = user.role.name.toLowerCase();
    const actions = this.validateActions(userRole);

    // Format user data
    const formattedUsers = users.map(({ nik, ...rest }) => {
      // Add roleName for frontend consistency
      const roleName = rest.role?.name || '';
      return { ...this.toUserResponse(rest), roleName };
    });

    return {
      data: formattedUsers,
      actions: actions,
      paging: {
        currentPage: page,
        totalPage: totalPage,
        size: size,
      },
    };
  }

  toUserResponse(data: UserResponse): UserResponse {
    return {
      ...data,
    };
  }

  userSelectFields() {
    return {
      id: true,
      participantId: true,
      idNumber: true,
      nik: true,
      email: true,
      name: true,
      dinas: true,
      roleId: true,
      role: true,
    };
  }

  private async findUser(userId: string): Promise<any> {
    const userSelectFields = this.userSelectFields();
    const findUser = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: userSelectFields,
    });
    return findUser;
  }

  private validateNikForUser(req: any) {
    if (!req.nik) {
      throw new HttpException('NIK tidak boleh kosong', 400);
    }
  }

  private async validateParticipantByNik(request: CreateUserRequest) {
    const participant = await this.prismaService.participant.findFirst({
      where: {
        OR: [{ nik: request.nik }, { email: request.email }],
      },
    });

    // Validasi idNumber, name, dan dinas
    if (participant) {
      if (request.nik && request.nik !== participant.nik) {
        throw new HttpException(
          'NIK tidak sesuai dengan data participant',
          400,
        );
      }

      if (request.idNumber && request.idNumber !== participant.idNumber) {
        console.log(request.idNumber);
        throw new HttpException(
          'No Pegawai tidak sesuai dengan data participant',
          400,
        );
      }

      if (request.name && request.name !== participant.name) {
        throw new HttpException(
          'Nama tidak sesuai dengan data participant',
          400,
        );
      }

      if (request.email && request.email !== participant.email) {
        throw new HttpException(
          'Email tidak sesuai dengan data participant',
          400,
        );
      }

      if (request.dinas && request.dinas !== participant.dinas) {
        throw new HttpException(
          'Dinas tidak sesuai dengan data participant',
          400,
        );
      }
    } else {
      await this.prismaService.participant.create({
        data: {
          idNumber: request.idNumber,
          name: request.name,
          nik: request.nik,
          dinas: request.dinas,
          email: request.email,
        },
      });
    }
  }

  private validateNikForNonUserRoles(nik: string) {
    if (nik) {
      throw new HttpException(
        'Role super admin, supervisor, dan LCU tidak perlu NIK',
        400,
      );
    }
  }

  private validateDinas(dinas: string, role: string) {
    if (!dinas) {
      throw new HttpException(`Role ${role} wajib harus memiliki dinas`, 400);
    }
  }

  private validateDinasForSuperAdmin(dinas: string) {
    if (dinas) {
      throw new HttpException('Role Super Admin tidak perlu dinas', 400);
    }
  }

  private validateRoleForLcuOrSupervisorRequest(
    reqRoleId: string,
    roleUserId: string,
  ): void {
    if (reqRoleId !== roleUserId) {
      throw new HttpException(
        'LCU hanya dapat membuat, mengakses, dan menghapus akun dengan role user',
        403,
      );
    }
  }

  private validateDinasForLcuRequest(dinasRequest: string, dinasLCU: string) {
    if (dinasRequest != dinasLCU) {
      throw new HttpException(
        'LCU hanya dapat membuat, mengakses, dan menghapus akun Pengguna dalam dinas yang sama',
        403,
      );
    }
  }

  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canEdit: true, canDelete: true, canView: true },
      supervisor: { canEdit: false, canDelete: false, canView: true },
      lcu: { canEdit: false, canDelete: false, canView: true },
    };

    return this.coreHelper.validateActions(userRole, accessMap);
  }

  private async findRoleUser(): Promise<RoleResponse> {
    const roleUser = await this.prismaService.role.findFirst({
      where: {
        name: {
          equals: 'user',
          mode: 'insensitive',
        },
      },
    });
    return roleUser;
  }
}
