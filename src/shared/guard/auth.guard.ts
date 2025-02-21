import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../common/service/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private prismaService: PrismaService,
    @Inject('ACCESS_JWT_SERVICE') private readonly accessJwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const accessToken = this.extractTokenFromCookie(request);

    if (!accessToken) {
      if (request.url.includes('auth/update-email/verify/')) {
        return true;
      } else {
        throw new HttpException('Unauthorized', 401);
      }
    }

    try {
      const verifyAccessToken =
        await this.accessJwtService.verifyAsync(accessToken);

      const user = await this.prismaService.user.findUnique({
        where: { id: verifyAccessToken.id },
        select: {
          id: true,
          participantId: true,
          idNumber: true,
          nik: true,
          email: true,
          name: true,
          dinas: true,
          refreshToken: true,
          accountVerificationToken: true,
          emailChangeToken: true,
          passwordResetToken: true,
          verifiedAccount: true,
          role: true,
        },
      });

      if (!user) {
        throw new HttpException('Pengguna tidak ditemukan', 404);
      }

      if (!user.verifiedAccount) {
        throw new HttpException('Akun belum diverifikasi', 403);
      }

      request.user = user;
    } catch (error) {
      console.log(error);
      throw new HttpException('Unauthorized', 401);
    }
    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies.access_token;
  }
}
