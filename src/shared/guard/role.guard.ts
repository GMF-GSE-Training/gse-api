import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/service/prisma.service';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.getRequiredRoles(context);
    const request = context.switchToHttp().getRequest();
    const user = await this.getUserWithRole(request);

    this.checkRoleAuthorization(user, requiredRoles);

    return true;
  }

  private getRequiredRoles(context: ExecutionContext): string[] {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      throw new HttpException('Forbidden', 403);
    }
    return requiredRoles;
  }

  private async getUserWithRole(request: any): Promise<any> {
    const user = request.user;

    if (!user) {
      throw new HttpException('Unauthorized', 401);
    }

    const userWithRole = await this.prismaService.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });

    if (!userWithRole || !userWithRole.role) {
      throw new HttpException('Forbidden', 403);
    }

    return userWithRole.role.name;
  }

  private checkRoleAuthorization(
    userRole: string,
    requiredRoles: string[],
  ): void {
    const hasRole = requiredRoles
      .map((role) => role.toLowerCase())
      .includes(userRole.toLowerCase());

    if (!hasRole) {
      throw new HttpException('Forbidden', 403);
    }
  }
}
