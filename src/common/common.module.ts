import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { ErrorFilter } from './error/error.filter.js';
import { CoreHelper } from './helpers/core.helper.js';
import { PrismaService } from './service/prisma.service.js';
import { TokenBlacklistService } from './service/token-blacklist.service.js';
import { ValidationService } from './service/validation.service.js';

/**
 * Modul global untuk menyediakan layanan umum yang dapat digunakan di seluruh aplikasi.
 * @description Menyediakan autentikasi JWT, database Prisma, validasi, dan utilitas umum.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({}), // Registrasi JwtModule untuk dependency injection
  ],
  providers: [
    PrismaService,
    ValidationService,
    TokenBlacklistService, // Opsional, hapus jika tidak ada di proyek Anda
    {
      provide: APP_FILTER,
      useClass: ErrorFilter,
    },
    CoreHelper,
    {
      provide: 'ACCESS_JWT_SERVICE',
      useFactory: (configService: ConfigService) =>
        new JwtService({
          secret: configService.get<string>('JWT_ACCESS_SECRET'),
          signOptions: { expiresIn: '1h' },
        }),
      inject: [ConfigService],
    },
    {
      provide: 'REFRESH_JWT_SERVICE',
      useFactory: (configService: ConfigService) =>
        new JwtService({
          secret: configService.get<string>('JWT_REFRESH_SECRET'),
          signOptions: { expiresIn: '1d' },
        }),
      inject: [ConfigService],
    },
    {
      provide: 'VERIFICATION_JWT_SERVICE',
      useFactory: (configService: ConfigService) =>
        new JwtService({
          secret: configService.get<string>('JWT_VERIFICATION_SECRET'),
          signOptions: { expiresIn: '15m' },
        }),
      inject: [ConfigService],
    },
  ],
  exports: [
    PrismaService,
    ValidationService,
    TokenBlacklistService, // Opsional, hapus jika tidak ada di proyek Anda
    JwtModule,
    CoreHelper,
    'ACCESS_JWT_SERVICE',
    'REFRESH_JWT_SERVICE',
    'VERIFICATION_JWT_SERVICE',
  ],
})
export class CommonModule {}
