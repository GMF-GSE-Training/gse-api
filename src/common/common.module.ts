import { Global, HttpException, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { PrismaService } from './service/prisma.service';
import { ValidationService } from './service/validation.service';
import { APP_FILTER } from '@nestjs/core';
import { ErrorFilter } from './error/error.filter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { extname } from 'path';
import { CoreHelper } from './helpers/core.helper';

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      format: winston.format.json(),
      transports: [new winston.transports.Console()],
    }),
    JwtModule.register({}),
    MulterModule.register({
      fileFilter: (_req, file, callback) => {
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf'];
        const fileExtension = extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
          return callback(
            new HttpException(
              `Format file untuk ${file.fieldname} tidak valid. Hanya file dengan format PNG, JPG, JPEG, dan PDF yang diperbolehkan.`,
              400,
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  ],
  providers: [
    PrismaService,
    ValidationService,
    {
      provide: APP_FILTER,
      useClass: ErrorFilter,
    },
    CoreHelper,
    {
      provide: 'ACCESS_JWT_SERVICE',
      useFactory: async (configService: ConfigService) =>
        new JwtService({
          secret: configService.get<string>('ACCESS_TOKEN'),
          signOptions: {
            expiresIn: '1h',
          },
        }),
      inject: [ConfigService],
    },
    {
      provide: 'REFRESH_JWT_SERVICE',
      useFactory: async (configService: ConfigService) =>
        new JwtService({
          secret: configService.get<string>('REFRESH_TOKEN'),
          signOptions: {
            expiresIn: '1d',
          },
        }),
      inject: [ConfigService],
    },
    {
      provide: 'VERIFICATION_JWT_SERVICE',
      useFactory: async (configService: ConfigService) =>
        new JwtService({
          secret: configService.get<string>('VERIFICATION_TOKEN'),
          signOptions: {
            expiresIn: '15m',
          },
        }),
      inject: [ConfigService],
    },
  ],
  exports: [
    PrismaService,
    ValidationService,
    JwtModule,
    CoreHelper,
    'ACCESS_JWT_SERVICE',
    'REFRESH_JWT_SERVICE',
    'VERIFICATION_JWT_SERVICE',
  ],
})
export class CommonModule {}
