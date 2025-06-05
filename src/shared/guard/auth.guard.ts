import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { Request } from 'express';

import { ACCESS_JWT_SERVICE } from '../../auth/jwt/jwt.constants.js';
import { CustomJwtService } from '../../auth/jwt/jwt.service.js';
import { PrismaService } from '../../common/service/prisma.service.js';
import { JwtPayload } from '../../model/auth.model.js';

/**
 * Guard untuk autentikasi berbasis JWT.
 * @description Memeriksa validitas token akses dan memastikan pengguna terautentikasi.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  /**
   * Konstruktor untuk menginisialisasi dependensi.
   * @param prismaService - Service untuk akses database.
   * @param accessJwtService - Service untuk verifikasi token JWT.
   */
  constructor(
    private prismaService: PrismaService,
    @Inject(ACCESS_JWT_SERVICE)
    private readonly accessJwtService: CustomJwtService
  ) {}

  /**
   * Memeriksa apakah permintaan dapat diizinkan berdasarkan token akses.
   * @param context - Konteks eksekusi NestJS.
   * @returns True jika autentikasi berhasil, false sebaliknya.
   * @throws HttpException jika autentikasi gagal.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const accessToken = this.extractTokenFromCookie(request);

    if (!accessToken) {
      if (request.url.includes('auth/update-email/verify/')) {
        return true;
      } else {
        throw new HttpException('Unauthorized', 401);
      }
    }

    try {
      const verifyAccessToken = (await this.accessJwtService.verifyAsync(
        accessToken
      )) as unknown as JwtPayload;

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
          refreshTokens: true,
          accountVerificationToken: true,
          updateEmailToken: true,
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Authentication failed', err.stack);
      throw new HttpException('Unauthorized', 401);
    }
    return true;
  }

  /**
   * Mengekstrak token akses dari cookie.
   * @param request - Objek permintaan HTTP.
   * @returns Token akses atau undefined jika tidak ada.
   */
  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies.access_token;
  }
}
