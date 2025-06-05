import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import sanitizeHtml from 'sanitize-html';

import { CoreHelper } from '../common/helpers/core.helper.js';
import { PrismaService } from '../common/service/prisma.service.js';
import { CurrentUserRequest } from '../model/auth.model.js';
import { RoleResponse } from '../model/role.model.js';
import { UserResponse } from '../model/user.model.js';
import { ActionAccessRights, ListRequest, Paging } from '../model/web.model.js';

import { CreateUserDto, UpdateUserDto } from './dto/user.dto.js';

/**
 * Service untuk operasi pengguna.
 */
@Injectable()
export class UserService {
  /**
   *
   * @param prismaService
   * @param configService
   * @param coreHelper
   */
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly coreHelper: CoreHelper
  ) {}

  /**
   * Mencatat tindakan untuk audit.
   * @param userId ID pengguna (opsional).
   * @param action Tindakan yang dilakukan.
   * @param details Detail tambahan.
   */
  private async logAudit(
    userId: string | null,
    action: string,
    details?: string
  ): Promise<void> {
    await this.prismaService.auditLog.create({
      data: { userId, action, details },
    });
  }

  /**
   * Membuat pengguna baru.
   * @param req Data pembuatan pengguna.
   * @param user Pengguna saat ini.
   * @returns Pesan sukses.
   */
  async createUser(
    req: CreateUserDto,
    user: CurrentUserRequest
  ): Promise<string> {
    const sanitizedReq = this.sanitizeInput(req);

    // Validasi bisnis: NIK wajib untuk role 'user'
    const role = await this.prismaService.role.findUnique({
      where: { id: sanitizedReq.roleId },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
    if (!role) {
      throw new HttpException('Role tidak ditemukan', HttpStatus.BAD_REQUEST);
    }
    if (role.name.toLowerCase() === 'user' && !sanitizedReq.nik) {
      throw new HttpException(
        'NIK wajib untuk role user',
        HttpStatus.BAD_REQUEST
      );
    }

    // Pastikan role 'user' ada jika tidak ditentukan
    if (!sanitizedReq.roleId) {
      const defaultRole = await this.findRoleUser();
      sanitizedReq.roleId = defaultRole.id;
    }

    // Validasi keunikan field
    await this.checkUniqueFields(sanitizedReq);

    // Validasi tambahan berdasarkan role
    const userRole = user.role.name.toLowerCase();
    const roleRequest = role.name.toLowerCase();
    if (roleRequest === 'user') {
      if (sanitizedReq.participantId) {
        const participant = await this.prismaService.participant.findFirst({
          where: { id: sanitizedReq.participantId },
        });
        if (!participant) {
          throw new HttpException(
            'Participant tidak ditemukan',
            HttpStatus.NOT_FOUND
          );
        }
      }
      await this.validateParticipantByNik(sanitizedReq);
    } else if (roleRequest === 'lcu' || roleRequest === 'supervisor') {
      this.validateNikForNonUserRoles(sanitizedReq.nik);
      this.validateDinas(sanitizedReq.dinas, roleRequest);
    } else {
      this.validateNikForNonUserRoles(sanitizedReq.nik);
      this.validateDinasForSuperAdmin(sanitizedReq.dinas);
    }

    if (userRole === 'lcu') {
      const roleUser = await this.findRoleUser();
      this.validateRoleForLcuOrSupervisorRequest(
        sanitizedReq.roleId,
        roleUser.id
      );
      this.validateDinasForLcuRequest(sanitizedReq.dinas, user.dinas);
    } else if (userRole === 'supervisor') {
      const roleUser = await this.findRoleUser();
      this.validateRoleForLcuOrSupervisorRequest(
        sanitizedReq.roleId,
        roleUser.id
      );
    }

    if (sanitizedReq.dinas) {
      sanitizedReq.dinas = sanitizedReq.dinas.toUpperCase();
    }

    // Hash kata sandi menggunakan argon2
    const hashedPassword = await argon2.hash(sanitizedReq.password, {
      memoryCost: this.configService.get<number>('ARGON2_MEMORY_COST', 65536),
      timeCost: this.configService.get<number>('ARGON2_TIME_COST', 3),
      parallelism: this.configService.get<number>('ARGON2_PARALLELISM', 1),
    });

    const userSelectFields = this.userSelectFields();

    // Gunakan transaksi untuk memastikan konsistensi
    await this.prismaService.$transaction(
      async prisma => {
        await prisma.user.create({
          data: {
            ...sanitizedReq,
            password: hashedPassword,
            hashAlgorithm: 'argon2',
            verifiedAccount: true,
          } as Prisma.UserUncheckedCreateInput,
          select: userSelectFields,
        });

        // Catat audit log
        await this.logAudit(
          user.id,
          'CREATE_USER',
          `User ${sanitizedReq.email} created by ${user.email}`
        );
      },
      { timeout: 10000 }
    );

    return 'User berhasil dibuat';
  }

  /**
   * Mengambil data pengguna berdasarkan ID.
   * @param userId ID pengguna.
   * @returns Data pengguna.
   */
  async getUser(userId: string): Promise<UserResponse> {
    const user = await this.findUser(userId);
    if (!user) {
      throw new HttpException('User tidak ditemukan', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  /**
   * Memperbarui pengguna.
   * @param userId ID pengguna.
   * @param req Data pembaruan pengguna.
   * @param user Pengguna saat ini.
   * @returns Pesan sukses.
   */
  async updateUser(
    userId: string,
    req: UpdateUserDto,
    user: CurrentUserRequest
  ): Promise<string> {
    const sanitizedReq = this.sanitizeInput(req);

    const findUser = await this.findUser(userId);
    if (!findUser) {
      throw new HttpException('User tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    const userRole = user.role.name.toLowerCase();
    let roleRequest = findUser.role?.name.toLowerCase() ?? '';

    // Validasi bisnis: NIK wajib untuk role 'user' jika roleId diubah
    if (sanitizedReq.roleId) {
      const role = await this.prismaService.role.findUnique({
        where: { id: sanitizedReq.roleId },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });
      if (!role) {
        throw new HttpException('Role tidak ditemukan', HttpStatus.BAD_REQUEST);
      }
      roleRequest = role.name.toLowerCase();
      if (roleRequest === 'user' && !sanitizedReq.nik) {
        throw new HttpException(
          'NIK wajib untuk role user',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    // Validasi tambahan berdasarkan role
    if (roleRequest === 'user') {
      if (sanitizedReq.participantId) {
        const participant = await this.prismaService.participant.findFirst({
          where: { id: sanitizedReq.participantId },
        });
        if (!participant) {
          throw new HttpException(
            'Participant tidak ditemukan',
            HttpStatus.NOT_FOUND
          );
        }
      }
      await this.validateParticipantByNik(sanitizedReq);
    } else if (roleRequest === 'lcu' || roleRequest === 'supervisor') {
      this.validateNikForNonUserRoles(sanitizedReq.nik);
      this.validateDinas(sanitizedReq.dinas, roleRequest);
    } else {
      this.validateNikForNonUserRoles(sanitizedReq.nik);
      this.validateDinasForSuperAdmin(sanitizedReq.dinas);
    }

    if (userRole === 'supervisor' && sanitizedReq.roleId) {
      const roleUser = await this.findRoleUser();
      this.validateRoleForLcuOrSupervisorRequest(
        sanitizedReq.roleId,
        roleUser.id
      );
    }

    if (userRole !== 'super admin' && sanitizedReq.email) {
      throw new HttpException(
        'Anda tidak bisa mengubah email pengguna',
        HttpStatus.FORBIDDEN
      );
    }

    // Validasi keunikan field
    await this.checkUniqueFields(sanitizedReq, userId);

    if (sanitizedReq.dinas) {
      sanitizedReq.dinas = sanitizedReq.dinas.toUpperCase();
    }

    // Persiapkan data update
    const updateData: {
      idNumber?: string | null;
      nik?: string | null;
      email?: string;
      name?: string;
      password?: string;
      dinas?: string | null;
      roleId?: string;
      participantId?: string | null;
      hashAlgorithm?: string;
    } = { ...sanitizedReq };

    if (sanitizedReq.password) {
      updateData.password = await argon2.hash(sanitizedReq.password, {
        memoryCost: this.configService.get<number>('ARGON2_MEMORY_COST', 65536),
        timeCost: this.configService.get<number>('ARGON2_TIME_COST', 3),
        parallelism: this.configService.get<number>('ARGON2_PARALLELISM', 1),
      });
      updateData.hashAlgorithm = 'argon2';
    }

    // Gunakan transaksi untuk memastikan konsistensi
    await this.prismaService.$transaction(
      async prisma => {
        await prisma.user.update({
          where: { id: userId },
          data: updateData,
          select: this.userSelectFields(),
        });

        // Update Participant jika nik ada
        if (findUser.nik && sanitizedReq.nik) {
          const updateParticipant: {
            idNumber?: string | null;
            name?: string;
            nik?: string;
            dinas?: string | null;
            email?: string;
          } = {
            idNumber: sanitizedReq.idNumber ?? findUser.idNumber,
            name: sanitizedReq.name ?? findUser.name,
            nik: sanitizedReq.nik ?? findUser.nik,
            dinas: sanitizedReq.dinas ?? findUser.dinas,
            email: sanitizedReq.email ?? findUser.email,
          };

          const participantUniqueChecks = [];
          if (
            sanitizedReq.idNumber &&
            sanitizedReq.idNumber !== findUser.idNumber
          ) {
            participantUniqueChecks.push({
              field: 'idNumber',
              value: sanitizedReq.idNumber,
              message: 'No Pegawai sudah digunakan di data peserta',
            });
          }
          if (sanitizedReq.email && sanitizedReq.email !== findUser.email) {
            participantUniqueChecks.push({
              field: 'email',
              value: sanitizedReq.email,
              message: 'Email sudah digunakan di data peserta',
            });
          }
          if (sanitizedReq.nik && sanitizedReq.nik !== findUser.nik) {
            participantUniqueChecks.push({
              field: 'nik',
              value: sanitizedReq.nik,
              message: 'NIK sudah digunakan di data peserta',
            });
          }

          const participant = await prisma.participant.findFirst({
            where: { nik: findUser.nik },
          });

          if (participant && participantUniqueChecks.length > 0) {
            await this.coreHelper.ensureUniqueFields(
              'participant',
              participantUniqueChecks,
              participant.id
            );
            await prisma.participant.update({
              where: { id: participant.id },
              data: updateParticipant,
            });
          }
        }

        // Catat audit log
        await this.logAudit(
          user.id,
          'UPDATE_USER',
          `User ${sanitizedReq.email || findUser.email} updated by ${user.email}`
        );
      },
      { timeout: 10000 }
    );

    return 'User berhasil diperbarui';
  }

  /**
   * Menghapus pengguna.
   * @param userId ID pengguna.
   * @returns Pesan sukses.
   */
  async delete(userId: string): Promise<string> {
    const findUser = await this.findUser(userId);
    if (!findUser) {
      throw new HttpException('User tidak ditemukan', HttpStatus.NOT_FOUND);
    }

    await this.prismaService.$transaction(
      async prisma => {
        await prisma.user.delete({ where: { id: userId } });
        await this.logAudit(
          null,
          'DELETE_USER',
          `User ${findUser.email} deleted`
        );
      },
      { timeout: 10000 }
    );

    return 'User berhasil dihapus';
  }

  /**
   * Mengambil daftar pengguna dengan paginasi.
   * @param request Parameter pencarian dan paginasi.
   * @param user Pengguna saat ini.
   * @returns Daftar pengguna, hak akses, dan informasi paginasi.
   */
  async listUsers(
    request: ListRequest,
    user: CurrentUserRequest
  ): Promise<{
    data: UserResponse[];
    actions: ActionAccessRights;
    paging: Paging;
  }> {
    const userSelectFields = this.userSelectFields();
    const whereCondition: any = {};

    const searchQuery = request.searchQuery;
    if (searchQuery) {
      whereCondition.OR = [
        { idNumber: { contains: searchQuery, mode: 'insensitive' } },
        { email: { contains: searchQuery, mode: 'insensitive' } },
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { role: { name: { contains: searchQuery, mode: 'insensitive' } } },
        { dinas: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    const totalUsers = await this.prismaService.user.count({
      where: whereCondition,
    });

    const page = request.page ?? 1;
    const size = request.size ?? 10;
    const skip = (page - 1) * size;

    const users = await this.prismaService.user.findMany({
      where: whereCondition,
      select: userSelectFields,
      skip,
      take: size,
    });

    const totalPage = Math.ceil(totalUsers / size);

    const userRole = user.role.name.toLowerCase();
    const actions = this.validateActions(userRole);

    const formattedUsers = users.map(userData => this.toUserResponse(userData));

    return {
      data: formattedUsers,
      actions,
      paging: {
        currentPage: page,
        totalPage,
        size,
        totalItems: totalUsers,
      },
    };
  }

  /**
   * Mengubah data pengguna menjadi respons.
   * @param data Data pengguna dari Prisma.
   * @returns Objek UserResponse.
   */
  toUserResponse(data: any): UserResponse {
    return {
      id: data.id,
      participantId: data.participantId,
      idNumber: data.idNumber,
      nik: data.nik,
      email: data.email,
      name: data.name,
      dinas: data.dinas,
      roleId: data.roleId,
      role: {
        id: data.role.id,
        name: data.role.name,
        createdAt: data.role.createdAt,
        updatedAt: data.role.updatedAt,
      },
      createdAt: data.createdAt,
      updatedAt: data.updatedAt, // Perbaikan typo
    };
  }

  /**
   * Mendapatkan kolom yang dipilih untuk respons pengguna.
   * @returns Objek kolom yang dipilih.
   */
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
      role: {
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      },
      createdAt: true,
      updatedAt: true,
      verifiedAccount: true,
    };
  }

  /**
   * Mencari pengguna berdasarkan ID.
   * @param userId ID pengguna.
   * @returns Data pengguna atau null.
   */
  private async findUser(userId: string): Promise<UserResponse | null> {
    const userSelectFields = this.userSelectFields();
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: userSelectFields,
    });
    return user ? this.toUserResponse(user) : null;
  }

  /**
   * Memeriksa keunikan field.
   * @param dto Data pengguna.
   * @param excludeId ID pengguna yang dikecualikan (opsional).
   */
  async checkUniqueFields(
    dto: CreateUserDto | UpdateUserDto,
    excludeId?: string
  ): Promise<void> {
    const uniqueChecks = [
      {
        field: 'idNumber',
        value: dto.idNumber,
        message: 'No pegawai sudah digunakan',
      },
      { field: 'email', value: dto.email, message: 'Email sudah digunakan' },
      { field: 'nik', value: dto.nik, message: 'NIK sudah digunakan' },
    ].filter(check => check.value !== undefined && check.value !== null);
    await this.coreHelper.ensureUniqueFields('user', uniqueChecks, excludeId);
  }

  /**
   * Membersihkan input pengguna.
   * @param input Data masukan.
   * @returns Data yang telah dibersihkan.
   */
  private sanitizeInput<T extends CreateUserDto | UpdateUserDto>(input: T): T {
    return {
      ...input,
      name: input.name
        ? sanitizeHtml(input.name, { allowedTags: [], allowedAttributes: {} })
        : input.name,
      dinas: input.dinas
        ? sanitizeHtml(input.dinas, { allowedTags: [], allowedAttributes: {} })
        : input.dinas,
    };
  }

  /**
   * Validasi NIK untuk role selain 'user'.
   * @param nik NIK pengguna.
   */
  private validateNikForNonUserRoles(nik: string | null | undefined): void {
    if (nik) {
      throw new HttpException(
        'Role super admin, supervisor, dan LCU tidak perlu NIK',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Validasi dinas untuk role LCU atau Supervisor.
   * @param dinas Kode dinas.
   * @param role Nama role.
   */
  private validateDinas(dinas: string | null | undefined, role: string): void {
    if (!dinas) {
      throw new HttpException(
        `Role ${role} wajib memiliki dinas`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Validasi dinas untuk role Super Admin.
   * @param dinas Kode dinas.
   */
  private validateDinasForSuperAdmin(dinas: string | null | undefined): void {
    if (dinas) {
      throw new HttpException(
        'Role Super Admin tidak perlu dinas',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Validasi role untuk LCU atau Supervisor.
   * @param reqRoleId ID role yang diminta.
   * @param roleUserId ID role 'user'.
   */
  private validateRoleForLcuOrSupervisorRequest(
    reqRoleId: string | undefined,
    roleUserId: string
  ): void {
    if (reqRoleId !== roleUserId) {
      throw new HttpException(
        'LCU atau Supervisor hanya dapat mengelola akun dengan role user',
        HttpStatus.FORBIDDEN
      );
    }
  }

  /**
   * Validasi dinas untuk LCU.
   * @param dinasRequest Dinas yang diminta.
   * @param dinasLCU Dinas LCU.
   */
  private validateDinasForLcuRequest(
    dinasRequest: string | null | undefined,
    dinasLCU: string | null | undefined
  ): void {
    if (dinasRequest && dinasLCU && dinasRequest !== dinasLCU) {
      throw new HttpException(
        'LCU hanya dapat mengelola akun dalam dinas yang sama',
        HttpStatus.FORBIDDEN
      );
    }
  }

  /**
   * Validasi hak akses berdasarkan role.
   * @param userRole Nama role pengguna.
   * @returns Hak akses.
   */
  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canEdit: true, canDelete: true },
      supervisor: { canEdit: false, canDelete: false },
    };
    return this.coreHelper.validateActions(userRole, accessMap);
  }

  /**
   * Mencari role 'user'.
   * @returns Data role 'user'.
   */
  private async findRoleUser(): Promise<RoleResponse> {
    const roleUser = await this.prismaService.role.findFirst({
      where: { name: { equals: 'user', mode: 'insensitive' } },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
    if (!roleUser) {
      throw new HttpException(
        'Role "user" tidak ditemukan',
        HttpStatus.NOT_FOUND
      );
    }
    return {
      id: roleUser.id,
      name: roleUser.name,
      createdAt: roleUser.createdAt,
      updatedAt: roleUser.updatedAt,
    };
  }

  /**
   * Validasi dan sinkronisasi data participant berdasarkan NIK.
   * @param request Data pengguna.
   */
  private async validateParticipantByNik(
    request: CreateUserDto | UpdateUserDto
  ): Promise<void> {
    const whereConditions = [];
    if (request.nik) {
      whereConditions.push({ nik: request.nik });
    }
    if (request.email) {
      whereConditions.push({ email: request.email });
    }

    if (whereConditions.length === 0) {
      return;
    }

    const participant = await this.prismaService.participant.findFirst({
      where: { OR: whereConditions },
    });

    if (participant) {
      if (request.nik && request.nik !== participant.nik) {
        throw new HttpException(
          'NIK tidak sesuai dengan data participant',
          HttpStatus.BAD_REQUEST
        );
      }
      if (request.idNumber && request.idNumber !== participant.idNumber) {
        throw new HttpException(
          'No Pegawai tidak sesuai dengan data participant',
          HttpStatus.BAD_REQUEST
        );
      }
      if (request.name && request.name !== participant.name) {
        throw new HttpException(
          'Nama tidak sesuai dengan data participant',
          HttpStatus.BAD_REQUEST
        );
      }
      if (request.email && request.email !== participant.email) {
        throw new HttpException(
          'Email tidak sesuai dengan data participant',
          HttpStatus.BAD_REQUEST
        );
      }
      if (request.dinas && request.dinas !== participant.dinas) {
        throw new HttpException(
          'Dinas tidak sesuai dengan data participant',
          HttpStatus.BAD_REQUEST
        );
      }
    } else if (request.nik) {
      await this.prismaService.participant.create({
        data: {
          idNumber: request.idNumber,
          name: request.name ?? '',
          nik: request.nik,
          dinas: request.dinas ?? '',
          email: request.email ?? '',
        },
      });
    }
  }
}
