import {
  Injectable,
  Logger,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  VERIFICATION_JWT_SERVICE,
  ACCESS_JWT_SERVICE,
  REFRESH_JWT_SERVICE,
} from '../../auth/jwt/jwt.constants.js';
import { CustomJwtService } from '../../auth/jwt/jwt.service.js';
import { JwtPayload } from '../../model/auth.model.js';

import { PrismaService } from './prisma.service.js';

/**
 * Service untuk mengelola token yang diblacklist.
 * @description Menyimpan, memeriksa, dan membersihkan token yang tidak valid menggunakan Prisma.
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(ACCESS_JWT_SERVICE)
    private readonly accessJwtService: CustomJwtService,
    @Inject(REFRESH_JWT_SERVICE)
    private readonly refreshJwtService: CustomJwtService,
    @Inject(VERIFICATION_JWT_SERVICE)
    private readonly verificationJwtService: CustomJwtService
  ) {}

  /**
   * Menambahkan token ke daftar blacklist.
   * @param token - Token yang akan diblacklist.
   * @param userId - ID pengguna terkait.
   * @param expiresAt - Waktu kedaluwarsa token.
   * @throws Error jika gagal menyimpan token ke database.
   */
  async blacklistToken(
    token: string,
    userId: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      await this.prismaService.blacklistedToken.create({
        data: {
          token,
          userId,
          expiresAt,
        },
      });
      this.logger.debug(`Token blacklisted for user ${userId}`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Failed to blacklist token: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Memeriksa apakah token ada di daftar blacklist.
   * @param token - Token yang akan diperiksa.
   * @returns True jika token diblacklist, false jika tidak.
   * @throws Error jika gagal memeriksa database.
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const tokenRecord = await this.prismaService.blacklistedToken.findUnique({
        where: { token },
      });
      if (tokenRecord) {
        this.logger.debug(`Token found in blacklist`);
        return true;
      }
      return false;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Failed to check blacklisted token: ${err.message}`,
        err.stack
      );
      throw err;
    }
  }

  /**
   * Membersihkan token yang sudah kedaluwarsa dari daftar blacklist.
   * @description Dijalankan setiap menit untuk menghapus token yang telah kedaluwarsa.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupBlacklistedTokens(): Promise<void> {
    try {
      const deleted = await this.prismaService.blacklistedToken.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
      if (deleted.count > 0) {
        this.logger.debug(
          `Cleaned up ${deleted.count} expired blacklisted tokens`
        );
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        `Failed to clean up blacklisted tokens: ${err.message}`,
        err.stack
      );
    }
  }

  /**
   * Memvalidasi token dan memeriksa status blacklist.
   * @param token - Token yang akan divalidasi.
   * @param type - Tipe token ('access', 'refresh', atau 'verification').
   * @returns Payload token jika valid dan tidak diblacklist.
   * @throws UnauthorizedException jika token tidak valid atau diblacklist.
   */
  async validateToken(
    token: string,
    type: 'access' | 'refresh' | 'verification'
  ): Promise<JwtPayload> {
    try {
      if (await this.isTokenBlacklisted(token)) {
        this.logger.warn(`Attempt to use blacklisted token`);
        throw new UnauthorizedException('Token has been blacklisted');
      }

      let jwtService: CustomJwtService;
      switch (type) {
        case 'access':
          jwtService = this.accessJwtService;
          break;
        case 'refresh':
          jwtService = this.refreshJwtService;
          break;
        case 'verification':
          jwtService = this.verificationJwtService;
          break;
        default:
          throw new UnauthorizedException('Invalid token type');
      }

      const payload = await jwtService.verifyAsync(token);
      this.logger.debug(`Token validated successfully for type: ${type}`);
      return payload as unknown as JwtPayload;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(`Token validation failed: ${err.message}`, err.stack);
      throw new UnauthorizedException('Invalid or blacklisted token');
    }
  }
}
