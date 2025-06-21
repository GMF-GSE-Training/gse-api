import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../common/service/prisma.service.js';
import { Role } from '../enums/role.enum.js';

@Injectable()
export class ParticipantAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const participantId = request.params.participantId;

    if (!user) return false;

    // Admins, Super Admins, Supervisor, LCU boleh akses semua
    const allowedRoles = [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.SUPERVISOR,
      Role.LCU,
    ];
    if (allowedRoles.includes(user.role?.name?.toLowerCase())) return true;

    // User hanya boleh akses data sendiri
    if (user.role?.name?.toLowerCase() === Role.USER) {
      const participant = await this.prisma.participant.findUnique({
        where: { id: participantId },
        select: { nik: true },
      });
      if (participant && participant.nik === user.nik) return true;
    }

    throw new ForbiddenException('Anda tidak memiliki akses ke resource ini.');
  }
}
