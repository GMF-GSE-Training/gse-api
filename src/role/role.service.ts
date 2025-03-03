import { HttpException, Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PrismaService } from '../common/service/prisma.service';
import { Logger } from 'winston';
import { RoleResponse } from 'src/model/role.model';
import { Role } from '@prisma/client';
import { CurrentUserRequest } from 'src/model/auth.model';
import { CoreHelper } from 'src/common/helpers/core.helper';

@Injectable()
export class RoleService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private logger: Logger,
    private readonly prismaService: PrismaService,
    private readonly coreHelper: CoreHelper,
  ) {}

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
      throw new HttpException('Forbidden', 403);
    }

    if (!roles || roles.length === 0) {
      throw new HttpException('Role tidak ditemukan', 404);
    }

    return roles.map((role) => this.toRoleResponse(role));
  }

  toRoleResponse(role: Role) {
    return {
      id: role.id,
      name: role.name,
    };
  }
}
