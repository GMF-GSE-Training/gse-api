import { HttpException, Injectable } from '@nestjs/common';

import { Role } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { PrismaService } from '../common/service/prisma.service.js';
import { CurrentUserRequest } from '../model/auth.model.js';
import { RoleResponse } from '../model/role.model.js';

/**
 * Service untuk mengelola role pengguna.
 */
@Injectable()
export class RoleService {
  /**
   * @param logger - Logger untuk mencatat aktivitas.
   * @param prismaService - Service untuk operasi database.
   */
  constructor(
    @InjectPinoLogger(RoleService.name) private logger: PinoLogger,
    private readonly prismaService: PrismaService
  ) {}

  /**
   * Mengambil semua role berdasarkan hak akses pengguna.
   * @param user - Pengguna yang sedang terautentikasi.
   * @returns Daftar role yang diizinkan.
   */
  async getAllRole(user: CurrentUserRequest): Promise<RoleResponse[]> {
    const userRole = user.role.name.toLowerCase();

    let roles: Role[];

    if (userRole === 'super admin') {
      // Super Admin dapat melihat semua role
      roles = await this.prismaService.role.findMany();
    } else if (userRole === 'supervisor' || userRole === 'lcu') {
      // Supervisor dan LCU hanya bisa melihat role 'user'
      roles = await this.prismaService.role.findMany({
        where: {
          name: {
            equals: 'user',
            mode: 'insensitive', // Case insensitive search
          },
        },
      });
    } else {
      this.logger.error(`Forbidden access for role: ${userRole}`, {
        context: 'RoleService',
        userId: user.id,
      });
      throw new HttpException('Forbidden', 403);
    }

    if (!roles || roles.length === 0) {
      this.logger.warn('No roles found', {
        context: 'RoleService',
        userId: user.id,
      });
      throw new HttpException('Role tidak ditemukan', 404);
    }

    this.logger.info(
      `Retrieved ${roles.length} roles for user: ${user.email}`,
      {
        context: 'RoleService',
        userId: user.id,
      }
    );
    return roles.map(role => this.toRoleResponse(role));
  }

  /**
   * Mengonversi entitas Role ke respons RoleResponse.
   * @param role - Entitas role dari database.
   * @returns Objek RoleResponse.
   */
  toRoleResponse(role: Role): RoleResponse {
    return {
      id: role.id,
      name: role.name,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
