import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { JwtPayload } from './../../model/auth.model.js';

/**
 * Service untuk mengelola operasi JWT.
 * @description Menangani penandatanganan dan verifikasi token JWT.
 */
@Injectable()
export class CustomJwtService {
  private readonly jwtService: JwtService;

  /**
   * @param configService - Service untuk mengakses konfigurasi aplikasi.
   * @param logger - Logger untuk mencatat operasi dan error.
   * @param secretKey - Kunci rahasia untuk JWT.
   * @param expiresIn - Waktu kedaluwarsa token.
   */
  constructor(
    configService: ConfigService,
    @InjectPinoLogger(CustomJwtService.name)
    private readonly logger: PinoLogger,
    secretKey: string,
    expiresIn: string
  ) {
    const secret = configService.get<string>(secretKey);
    if (!secret) {
      this.logger.error(`JWT secret for ${secretKey} is missing`, {
        context: 'CustomJwtService',
      });
      throw new Error(`JWT secret for ${secretKey} is missing`);
    }
    this.jwtService = new JwtService({
      secret,
      signOptions: { expiresIn },
    });
    this.logger.debug(`Initialized JWT Service with secret: ${secretKey}`, {
      context: 'CustomJwtService',
    });
  }

  /**
   * Menandatangani payload untuk menghasilkan token JWT.
   * @param payload - Data yang akan ditandatangani.
   * @returns Token JWT yang dihasilkan.
   */
  async signAsync(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  /**
   * Memverifikasi token JWT.
   * @param token - Token JWT yang akan diverifikasi.
   * @returns Payload yang didekodekan dari token sebagai objek.
   * @throws Error jika verifikasi gagal.
   */
  async verifyAsync<T extends JwtPayload>(token: string): Promise<T> {
    try {
      return await this.jwtService.verifyAsync<T>(token);
    } catch (error: unknown) {
      if (
        error instanceof JsonWebTokenError ||
        error instanceof TokenExpiredError
      ) {
        this.logger.error(`Token verification failed: ${error.message}`, {
          context: 'CustomJwtService',
        });
        throw error;
      }
      throw error;
    }
  }
}
