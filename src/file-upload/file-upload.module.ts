import { Module, Logger, BadRequestException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';

import { Request } from 'express';
import * as multer from 'multer';
import { Histogram, Counter } from 'prom-client';

import { PrismaService } from '../common/service/prisma.service.js';
import { MailService } from '../mail/mail.service.js';

import { FileUploadController } from './file-upload.controller.js';
import { FileUploadService } from './file-upload.service.js';
import {
  PROM_HISTOGRAM_UPLOAD,
  PROM_HISTOGRAM_DOWNLOAD,
  PROM_HISTOGRAM_DELETE,
  PROM_COUNTER_ERRORS,
} from './metrics.tokens.js';
import { AlibabaStorageProvider } from './providers/alibaba-storage.provider.js';
import { AwsStorageProvider } from './providers/aws-storage.provider.js';
import { GcpStorageProvider } from './providers/gcp-storage.provider.js';
import { LocalStorageProvider } from './providers/local-storage.provider.js';
import { NasStorageProvider } from './providers/nas-storage.provider.js';

/**
 * File upload module for handling file uploads with multiple storage providers.
 * @description Integrates rate limiting, JWT authentication, and email notifications.
 */
@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async () => ({
        throttlers: [{ ttl: 60, limit: 10 }],
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService
      ): Promise<JwtModuleOptions> => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MulterMiddleware');
        const allowedMimeTypes = configService
          .get<string>(
            'ALLOWED_MIME_TYPES',
            'image/jpeg,image/png,application/pdf'
          )
          .split(',');
        const maxFileSize = configService.get<number>(
          'MAX_FILE_SIZE',
          5 * 1024 * 1024
        );

        return {
          storage: multer.memoryStorage(),
          limits: { fileSize: maxFileSize },
          fileFilter: (
            _req: Request,
            file: Express.Multer.File,
            cb: (error: Error | null, acceptFile: boolean) => void
          ) => {
            if (!allowedMimeTypes.includes(file.mimetype)) {
              logger.error(`Invalid file type: ${file.mimetype}`);
              return cb(
                new BadRequestException(
                  `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
                ),
                false
              );
            }
            logger.debug(
              `File accepted: ${file.originalname}, type: ${file.mimetype}`
            );
            cb(null, true);
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [FileUploadController],
  providers: [
    FileUploadService,
    LocalStorageProvider,
    NasStorageProvider,
    GcpStorageProvider,
    AwsStorageProvider,
    AlibabaStorageProvider,
    PrismaService,
    MailService,
    {
      provide: PROM_HISTOGRAM_UPLOAD,
      useValue: new Histogram({
        name: 'local_storage_upload_duration_seconds',
        help: 'Duration of local storage upload operations',
        labelNames: ['success'],
      }),
    },
    {
      provide: PROM_HISTOGRAM_DOWNLOAD,
      useValue: new Histogram({
        name: 'local_storage_download_duration_seconds',
        help: 'Duration of local storage download operations',
        labelNames: ['success'],
      }),
    },
    {
      provide: PROM_HISTOGRAM_DELETE,
      useValue: new Histogram({
        name: 'local_storage_delete_duration_seconds',
        help: 'Duration of local storage delete operations',
        labelNames: ['success'],
      }),
    },
    {
      provide: PROM_COUNTER_ERRORS,
      useValue: new Counter({
        name: 'local_storage_operation_errors_total',
        help: 'Total number of local storage operation errors',
        labelNames: ['operation'],
      }),
    },
  ],
  exports: [FileUploadService],
})
export class FileUploadModule {}
