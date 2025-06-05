import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import {
  ACCESS_JWT_SERVICE,
  REFRESH_JWT_SERVICE,
  VERIFICATION_JWT_SERVICE,
} from './jwt.constants.js';
import { CustomJwtService } from './jwt.service.js';

/**
 * Modul untuk mengelola layanan JWT.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ACCESS_JWT_SERVICE,
      useFactory: (configService: ConfigService, logger: PinoLogger) => {
        const secretKey = 'JWT_ACCESS_SECRET';
        const expiresIn = configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m'
        );
        validateJwtSecrets(configService, secretKey, logger);
        return new CustomJwtService(
          configService,
          logger,
          secretKey,
          expiresIn
        );
      },
      inject: [ConfigService, { token: 'PinoLogger', optional: false }],
    },
    {
      provide: REFRESH_JWT_SERVICE,
      useFactory: (configService: ConfigService, logger: PinoLogger) => {
        const secretKey = 'JWT_REFRESH_SECRET';
        const expiresIn = configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d'
        );
        validateJwtSecrets(configService, secretKey, logger);
        return new CustomJwtService(
          configService,
          logger,
          secretKey,
          expiresIn
        );
      },
      inject: [ConfigService, { token: 'PinoLogger', optional: false }],
    },
    {
      provide: VERIFICATION_JWT_SERVICE,
      useFactory: (configService: ConfigService, logger: PinoLogger) => {
        const secretKey = 'JWT_VERIFICATION_SECRET';
        const expiresIn = configService.get<string>(
          'JWT_VERIFICATION_EXPIRES_IN',
          '15m'
        );
        validateJwtSecrets(configService, secretKey, logger);
        return new CustomJwtService(
          configService,
          logger,
          secretKey,
          expiresIn
        );
      },
      inject: [ConfigService, { token: 'PinoLogger', optional: false }],
    },
  ],
  exports: [ACCESS_JWT_SERVICE, REFRESH_JWT_SERVICE, VERIFICATION_JWT_SERVICE],
})
export class JwtModule {
  /**
   * Konstruktor untuk validasi kunci rahasia JWT.
   * @param configService - Service untuk mengakses konfigurasi.
   * @param logger - Logger untuk mencatat aktivitas.
   */
  constructor(
    configService: ConfigService,
    @InjectPinoLogger(JwtModule.name) private readonly logger: PinoLogger
  ) {
    const secrets = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_VERIFICATION_SECRET',
    ];
    // Validasi bahwa semua rahasia berbeda
    const secretValues = secrets.map(key => configService.get<string>(key));
    const uniqueSecrets = new Set(secretValues);
    if (uniqueSecrets.size !== secrets.length) {
      this.logger.error('JWT secrets harus berbeda untuk keamanan', {
        context: 'JwtModule',
      });
      throw new Error('JWT secrets harus berbeda untuk keamanan');
    }
  }
}

/**
 * Validasi kunci rahasia JWT.
 * @param configService - Service untuk mengakses konfigurasi.
 * @param secretKey - Nama kunci rahasia.
 * @param logger - Logger untuk mencatat error.
 */
function validateJwtSecrets(
  configService: ConfigService,
  secretKey: string,
  logger: PinoLogger
) {
  const secret = configService.get<string>(secretKey);
  if (!secret) {
    logger.error(`Missing JWT secret: ${secretKey}`, { context: 'JwtModule' });
    throw new Error(`Missing JWT secret: ${secretKey}`);
  }
  if (secret.length < 32) {
    logger.error(
      `JWT secret ${secretKey} must be at least 32 characters long`,
      { context: 'JwtModule' }
    );
    throw new Error(
      `JWT secret ${secretKey} must be at least 32 characters long`
    );
  }
}
