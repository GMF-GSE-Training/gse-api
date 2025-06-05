import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';
import { Request } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CoreHelper } from '../common/helpers/core.helper.js';
import { UrlHelper } from '../common/helpers/url.helper.js';
import { AppConfigService } from '../common/service/app-config.service.js';
import { PrismaService } from '../common/service/prisma.service.js';
import { ValidationService } from '../common/service/validation.service.js';
import { FileUploadService } from '../file-upload/file-upload.service.js';
import { MailModule } from '../mail/mail.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleStrategy } from './google.strategy.js';
import { JwtModule } from './jwt/jwt.module.js';
import { MicrosoftStrategy } from './microsoft.strategy.js';

/**
 * Modul untuk fungsi autentikasi.
 * @description Mengelola autentikasi pengguna, termasuk login, OAuth, dan manajemen token.
 */
@Module({
  imports: [
    ConfigModule,
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule,
    ThrottlerModule.forRoot([
      { name: 'sensitive', ttl: 60, limit: 5 },
      { name: 'general', ttl: 60, limit: 10 },
    ]),
    GoogleRecaptchaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secretKey: configService.get<string>('RECAPTCHA_SECRET_KEY'),
        response: (req: Request) => req.headers['recaptcha'] as string,
        score: configService.get<number>('RECAPTCHA_SCORE_THRESHOLD', 0.6),
        action: (req: Request) => req.url.split('/').pop() || 'default',
      }),
      inject: [ConfigService],
    }),
    MailModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    MicrosoftStrategy,
    PrismaService,
    ValidationService,
    AppConfigService,
    CoreHelper,
    FileUploadService,
    UrlHelper,
  ],
  exports: [AuthService],
})
export class AuthModule {
  /**
   * Konstruktor untuk validasi variabel lingkungan JWT.
   * @param configService - Service untuk mengakses variabel lingkungan.
   * @param logger - Service untuk logging.
   */
  constructor(
    configService: ConfigService,
    @InjectPinoLogger(AuthModule.name) private readonly logger: PinoLogger
  ) {
    const secrets = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_VERIFICATION_SECRET',
    ];
    secrets.forEach(secret => {
      if (!configService.get<string>(secret)) {
        this.logger.error(`Missing environment variable: ${secret}`, {
          context: 'AuthModule',
        });
      } else {
        this.logger.debug(`${secret} loaded successfully`, {
          context: 'AuthModule',
        });
      }
    });
  }
}
