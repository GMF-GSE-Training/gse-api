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
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private prismaService: PrismaService,
    @Inject('ACCESS_JWT_SERVICE') private readonly accessJwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    const request = context.switchToHttp().getRequest();
    // Ambil token dari cookie, jika tidak ada cek header
    let accessToken = this.extractTokenFromCookie(request);
    if (!accessToken) {
      accessToken = this.extractTokenFromHeader(request);
    }

    // Jika endpoint public dan tidak ada token, tetap bisa akses
    if (isPublic && !accessToken) {
      return true;
    }

    // Jika endpoint public dan ada token, coba set user (optional auth)
    if (isPublic && accessToken) {
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

        if (user && user.verifiedAccount) {
          request.user = user;
        }
      } catch (error) {
        // Jika token invalid, tetap bisa akses karena endpoint public
        // request.user akan tetap undefined
      }
      return true;
    }

    // Jika bukan public endpoint, wajib ada token
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

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return undefined;
  }
}
