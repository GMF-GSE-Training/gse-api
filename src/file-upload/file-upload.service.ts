import * as path from 'path';
import { performance } from 'perf_hooks';
import { Worker } from 'worker_threads';

import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { FileMetadata } from '@prisma/client';
import retry from 'async-retry';
import { fileTypeFromBuffer } from 'file-type';
import NodeCache from 'node-cache';
import CircuitBreaker from 'opossum';
import { Counter, Histogram } from 'prom-client';
import sanitizePath from 'sanitize-filename';
import { validate as isUUID } from 'uuid';

import { PrismaService } from '../common/service/prisma.service.js';
import { SendEmail } from '../model/mail.model.js';

import {
  FileValidationException,
  StorageOperationException,
} from './exceptions/file.exceptions.js';
import { AlibabaStorageProvider } from './providers/alibaba-storage.provider.js';
import { AwsStorageProvider } from './providers/aws-storage.provider.js';
import { GcpStorageProvider } from './providers/gcp-storage.provider.js';
import { LocalStorageProvider } from './providers/local-storage.provider.js';
import { NasStorageProvider } from './providers/nas-storage.provider.js';
import { StorageProvider } from './storage-provider.interface.js';

// Interface for MailService
interface MailService {
  sendEmail(email: SendEmail): Promise<any>;
}

// Interface for LogContext to ensure requestId is typed
interface LogContext {
  requestId?: string | undefined;
  participantId?: string;
  subfolder?: string;
  fileName?: string;
  fileSize?: number;
  operation?: string;
  fileId?: number;
  [key: string]: any;
}

// Type definition for circuit breakers
type CircuitBreakerMap = {
  [key in 'nas' | 'gcp' | 'aws' | 'alibaba']?: {
    upload: CircuitBreaker<
      [Express.Multer.File, string, string | undefined],
      string
    >;
    download: CircuitBreaker<
      [string, string | undefined],
      { buffer: Buffer; mimeType: string }
    >;
    delete: CircuitBreaker<[string, string | undefined], void>;
  };
};

/**
 * Service for managing file upload, download, and deletion operations.
 * @description Supports multiple storage providers with AES-256-CBC encryption for sensitive files.
 * Implements strict input validation, structured logging, in-memory caching, Prometheus metrics, circuit breakers, and robust error handling.
 * @example
 * const fileUploadService = new FileUploadService(configService, prismaService, ...);
 * const result = await fileUploadService.uploadFile(file, '123e4567-e89b-12d3-a456-426614174000', 'ktp', true);
 */
@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly providers: { [key: string]: StorageProvider };
  private readonly circuitBreakers: CircuitBreakerMap;
  private readonly allowedMimeTypes: string[];
  private readonly maxFileSize: number;
  private readonly storageType: string;
  private readonly cache: NodeCache;
  private readonly adminEmail: string | undefined;
  private readonly notificationCache: NodeCache;
  private readonly subfolderRelations: { [key: string]: string };
  private readonly uploadDuration: Histogram<string>;
  private readonly downloadDuration: Histogram<string>;
  private readonly deleteDuration: Histogram<string>;
  private readonly errorCounter: Counter<string>;
  private readonly cacheHitCounter: Counter<string>;
  private readonly cacheMissCounter: Counter<string>;
  private readonly maxNotificationsPerType = 100; // Limit notifications per type

  /**
   *
   * @param configService
   * @param prismaService
   * @param localProvider
   * @param nasProvider
   * @param gcpProvider
   * @param awsProvider
   * @param alibabaProvider
   * @param mailService
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly localProvider: LocalStorageProvider,
    private readonly nasProvider: NasStorageProvider,
    private readonly gcpProvider: GcpStorageProvider,
    private readonly awsProvider: AwsStorageProvider,
    private readonly alibabaProvider: AlibabaStorageProvider,
    private readonly mailService: MailService
  ) {
    // Initialize providers
    this.providers = {
      local: this.localProvider,
      nas: this.nasProvider,
      gcp: this.gcpProvider,
      aws: this.awsProvider,
      alibaba: this.alibabaProvider,
    };

    // Initialize circuit breakers
    this.circuitBreakers = this.initializeCircuitBreakers();

    // Initialize configurations
    this.storageType = this.configService.get<string>('STORAGE_TYPE', 'local');
    this.allowedMimeTypes = this.configService
      .get<string>('ALLOWED_MIME_TYPES', 'image/jpeg,image/png,application/pdf')
      .split(',');
    this.maxFileSize = this.configService.get<number>(
      'MAX_FILE_SIZE',
      5 * 1024 * 1024
    );
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 1000 });
    this.notificationCache = new NodeCache({
      stdTTL: 24 * 60 * 60,
      checkperiod: 60,
      maxKeys: 1000,
    });

    this.adminEmail = this.configService.get<string>('MAIL_ADMIN_NOTIFY');
    if (!this.adminEmail) {
      this.logger.warn(
        'MAIL_ADMIN_NOTIFY not configured. Email notifications are disabled.'
      );
    }

    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailPort = this.configService.get<number>('MAIL_PORT');
    if (mailHost !== 'smtp.gmail.com' || mailPort !== 587) {
      this.logger.warn(
        `Mail configuration may not use TLS. Expected MAIL_HOST=smtp.gmail.com and MAIL_PORT=587, got MAIL_HOST=${mailHost}, MAIL_PORT=${mailPort}`
      );
    }

    this.subfolderRelations = this.configService.get<{ [key: string]: string }>(
      'SUBFOLDER_RELATIONS',
      {
        simA: 'participantSimA',
        simB: 'participantSimB',
        ktp: 'participantKtp',
        foto: 'participantFoto',
        suratSehatButaWarna: 'participantSuratSehatButaWarna',
        suratBebasNarkoba: 'participantSuratBebasNarkoba',
        qrCode: 'participantQrCode',
      }
    );

    // Initialize Prometheus metrics
    this.uploadDuration = new Histogram({
      name: 'file_upload_duration_seconds',
      help: 'Duration of file upload operations',
      labelNames: ['storage_type', 'success'],
    });
    this.downloadDuration = new Histogram({
      name: 'file_download_duration_seconds',
      help: 'Duration of file download operations',
      labelNames: ['storage_type', 'success'],
    });
    this.deleteDuration = new Histogram({
      name: 'file_delete_duration_seconds',
      help: 'Duration of file delete operations',
      labelNames: ['storage_type', 'success'],
    });
    this.errorCounter = new Counter({
      name: 'file_operation_errors_total',
      help: 'Total number of file operation errors',
      labelNames: ['operation', 'storage_type'],
    });
    this.cacheHitCounter = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['operation'],
    });
    this.cacheMissCounter = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['operation'],
    });

    // Handle cache eviction
    this.cache.on('del', (key, reason) => {
      if (reason === 'expired' || reason === 'evicted') {
        this.logger.warn(`Cache key ${key} evicted: ${reason}`);
      }
    });
  }

  /**
   * Initializes circuit breakers for external storage providers.
   * @returns Object mapping provider names to operation-specific circuit breakers.
   */
  private initializeCircuitBreakers(): CircuitBreakerMap {
    const breakers: CircuitBreakerMap = {};
    const externalProviders = ['nas', 'gcp', 'aws', 'alibaba'] as const;
    const breakerOptions = {
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    };

    for (const provider of externalProviders) {
      const providerInstance = this.providers[provider];
      if (!providerInstance) {
        this.logger.error(`Provider ${provider} not found`);
        continue;
      }

      breakers[provider] = {
        upload: new CircuitBreaker(
          async (
            file: Express.Multer.File,
            fileName: string,
            requestId: string | undefined
          ) => {
            return await providerInstance.upload(file, fileName, requestId);
          },
          breakerOptions
        ),
        download: new CircuitBreaker(
          async (filePath: string, requestId: string | undefined) => {
            return await providerInstance.download(filePath, requestId);
          },
          breakerOptions
        ),
        delete: new CircuitBreaker(
          async (filePath: string, requestId: string | undefined) => {
            return await providerInstance.delete(filePath, requestId);
          },
          breakerOptions
        ),
      };

      for (const operation of ['upload', 'download', 'delete'] as const) {
        breakers[provider]![operation].on('open', () => {
          this.logger.warn(
            `Circuit breaker opened for ${provider} ${operation}`
          );
          this.errorCounter.inc({
            operation: `circuit_breaker_open_${operation}`,
            storage_type: provider,
          });
        });
        breakers[provider]![operation].on('halfOpen', () => {
          this.logger.log(
            `Circuit breaker half-open for ${provider} ${operation}`
          );
        });
        breakers[provider]![operation].on('close', () => {
          this.logger.log(
            `Circuit breaker closed for ${provider} ${operation}`
          );
        });
      }
    }

    return breakers;
  }

  /**
   * Maps subfolder to Prisma relation field.
   * @param subfolder Storage subfolder (e.g., 'ktp', 'simA').
   * @returns Prisma relation field name or null if invalid.
   */
  private getPrismaRelation(subfolder: string): string | null {
    return this.subfolderRelations[subfolder] || null;
  }

  /**
   * Sends a notification email with retry logic.
   * @param email Email data to send.
   * @param logContext Logging context for tracking.
   * @param cacheKey Cache key to prevent duplicate notifications.
   */
  private async sendNotificationEmail(
    email: SendEmail,
    logContext: LogContext,
    cacheKey: string
  ): Promise<void> {
    if (!this.adminEmail || this.notificationCache.get(cacheKey)) {
      return;
    }

    try {
      await this.retryEmail(email);
      this.notificationCache.set(cacheKey, true, 3600);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send notification: ${errorMessage}`,
        logContext
      );
      this.errorCounter.inc({
        operation: 'send_notification',
        storage_type: this.storageType,
      });
    }
  }

  /**
   * Uploads a file to the configured storage provider.
   * @param file Multer file to be uploaded.
   * @param participantId UUID of the participant.
   * @param subfolder Storage subfolder (e.g., 'ktp', 'simA').
   * @param isSensitive Whether the file should be encrypted (default: true).
   * @param requestId Unique ID for request tracking (optional).
   * @returns Object containing the file ID and path.
   */
  async uploadFile(
    file: Express.Multer.File,
    participantId: string,
    subfolder: string,
    isSensitive: boolean = true,
    requestId?: string
  ): Promise<{ fileId: number; path: string }> {
    const startTime = performance.now();
    const logContext: LogContext = {
      requestId,
      participantId,
      subfolder,
      fileName: file?.originalname,
      fileSize: file?.size,
      operation: 'upload',
    };
    const end = this.uploadDuration.startTimer({
      storage_type: this.storageType,
    });

    this.logger.log('Starting file upload', logContext);

    try {
      await this.validateUploadInput(
        file,
        participantId,
        subfolder,
        logContext
      );

      const fileName = `participants/${participantId}/${subfolder}/${Date.now()}-${this.sanitizeFileName(file.originalname)}`;
      let iv: string | null = null;

      if (isSensitive && file.buffer) {
        const { encrypted, iv: encryptionIv } = await this.encryptFileAsync(
          file.buffer,
          logContext
        );
        file.buffer = encrypted;
        iv = encryptionIv;
        this.logger.log(`File encrypted for ${file.originalname}`, logContext);
      }

      const provider = this.providers[this.storageType];
      const filePath = await this.uploadWithCircuitBreaker(
        provider,
        file,
        fileName,
        logContext
      );

      const relationField = this.getPrismaRelation(subfolder);
      if (!relationField) {
        throw new FileValidationException(
          `Invalid subfolder: ${subfolder}. Must be one of ${Object.keys(this.subfolderRelations).join(', ')}`,
          logContext
        );
      }

      const fileMetadata = await this.prismaService.fileMetadata.create({
        data: {
          path: filePath,
          fileName: this.sanitizeFileName(file.originalname),
          mimeType: file.mimetype,
          fileSize: file.size,
          storageType: this.storageType,
          iv,
          isSensitive,
          createdAt: new Date(),
          [relationField]: {
            connect: { id: participantId },
          },
        },
      });

      this.cache.set(`file:${fileMetadata.id}`, fileMetadata);
      this.cacheHitCounter.inc({ operation: 'set' });

      if (isSensitive && this.adminEmail) {
        const notifications =
          this.notificationCache.get<string[]>('sensitiveNotifications') || [];
        if (notifications.length < this.maxNotificationsPerType) {
          notifications.push(
            `Sensitive file ${file.originalname} uploaded for participant ${participantId} to ${subfolder}`
          );
          this.notificationCache.set('sensitiveNotifications', notifications);
        } else {
          this.logger.warn('Sensitive notifications limit reached', logContext);
        }
      }

      const duration = performance.now() - startTime;
      this.logger.log(`File uploaded successfully`, {
        ...logContext,
        fileId: fileMetadata.id,
        path: filePath,
        duration: `${duration.toFixed(2)}ms`,
      });

      end({ success: 'true' });
      return { fileId: fileMetadata.id, path: filePath };
    } catch (error) {
      this.errorCounter.inc({
        operation: 'upload',
        storage_type: this.storageType,
      });
      end({ success: 'false' });

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`File upload failed: ${errorMessage}`, logContext);

      if (file && this.storageType !== 'local') {
        try {
          const fallbackPath = await this.localProvider.upload(
            file,
            `fallback/${Date.now()}-${file.originalname}`,
            requestId
          );
          await this.sendNotificationEmail(
            {
              from: {
                name: 'GMF Aeroasia',
                address: this.configService.get<string>('MAIL_USER')!,
              },
              recipients: [{ name: 'Admin', address: this.adminEmail! }],
              subject: `Upload Failed: ${file.originalname}`,
              template: 'upload-failure',
              context: {
                fileName: file.originalname,
                participantId,
                subfolder,
                errorMessage,
                fallbackPath,
              },
            },
            logContext,
            `fallback:${file.originalname}`
          );
          this.logger.log(
            `File saved to local fallback: ${fallbackPath}`,
            logContext
          );
        } catch (fallbackError) {
          const fallbackErrorMessage =
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Unknown error';
          this.logger.error(
            `Fallback save failed: ${fallbackErrorMessage}`,
            logContext
          );
          this.errorCounter.inc({
            operation: 'upload_fallback',
            storage_type: 'local',
          });
        }
      }

      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `File upload failed: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Downloads a file by its ID.
   * @param fileId Unique ID from FileMetadata.
   * @param requestId Unique ID for request tracking (optional).
   * @returns Object containing the file buffer and MIME type.
   */
  async getFile(
    fileId: number,
    requestId?: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const startTime = performance.now();
    const logContext: LogContext = { requestId, fileId, operation: 'download' };
    const end = this.downloadDuration.startTimer({
      storage_type: this.storageType,
    });

    this.logger.log('Starting file retrieval', logContext);

    try {
      if (!Number.isInteger(fileId) || fileId <= 0) {
        throw new FileValidationException('Invalid file ID', logContext);
      }

      const cached = this.cache.get<FileMetadata | undefined>(`file:${fileId}`);
      let fileMetadata: FileMetadata;

      if (cached) {
        fileMetadata = cached;
        this.logger.log('Retrieved metadata from cache', logContext);
        this.cacheHitCounter.inc({ operation: 'get' });
      } else {
        const metadata = await this.prismaService.fileMetadata.findUnique({
          where: { id: fileId },
        });
        if (!metadata) {
          throw new FileValidationException('File not found', logContext);
        }
        fileMetadata = metadata;
        this.cache.set(`file:${fileId}`, fileMetadata);
        this.cacheMissCounter.inc({ operation: 'get' });
      }

      if (!this.providers[fileMetadata.storageType]) {
        throw new StorageOperationException(
          `Unsupported storage type: ${fileMetadata.storageType}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
          logContext
        );
      }
      const provider = this.providers[fileMetadata.storageType];

      const { buffer: storedBuffer, mimeType } =
        await this.downloadWithCircuitBreaker(
          provider,
          fileMetadata.path,
          logContext
        );
      const finalBuffer =
        fileMetadata.isSensitive && fileMetadata.iv
          ? await this.decryptFileAsync(
              storedBuffer,
              fileMetadata.iv,
              logContext
            )
          : storedBuffer;

      const duration = performance.now() - startTime;
      this.logger.log(`File retrieved successfully`, {
        ...logContext,
        mimeType,
        duration: `${duration.toFixed(2)}ms`,
      });

      end({ success: 'true' });
      return { buffer: finalBuffer, mimeType };
    } catch (error) {
      this.errorCounter.inc({
        operation: 'download',
        storage_type: this.storageType,
      });
      end({ success: 'false' });

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`File retrieval failed: ${errorMessage}`, logContext);

      if (error instanceof StorageOperationException && this.adminEmail) {
        await this.sendNotificationEmail(
          {
            from: {
              name: 'GMF Aeroasia',
              address: this.configService.get<string>('MAIL_USER')!,
            },
            recipients: [{ name: 'Admin', address: this.adminEmail }],
            subject: `Download Failed: File ID ${fileId}`,
            template: 'operation-failure',
            context: { fileId, operation: 'download', errorMessage },
          },
          logContext,
          `download_error:${fileId}`
        );
      }

      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `File retrieval failed: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Deletes a file by its ID.
   * @param fileId Unique ID from FileMetadata.
   * @param requestId Unique ID for request tracking (optional).
   */
  async deleteFile(fileId: number, requestId?: string): Promise<void> {
    const startTime = performance.now();
    const logContext: LogContext = { requestId, fileId, operation: 'delete' };
    const end = this.deleteDuration.startTimer({
      storage_type: this.storageType,
    });

    this.logger.log('Starting file deletion', logContext);

    try {
      if (!Number.isInteger(fileId) || fileId <= 0) {
        throw new FileValidationException('Invalid file ID', logContext);
      }

      const cached = this.cache.get<FileMetadata | undefined>(`file:${fileId}`);
      let fileMetadata: FileMetadata;

      if (cached) {
        fileMetadata = cached;
        this.cacheHitCounter.inc({ operation: 'get' });
      } else {
        const metadata = await this.prismaService.fileMetadata.findUnique({
          where: { id: fileId },
        });
        if (!metadata) {
          this.logger.warn(
            `File not found for deletion: ${fileId}`,
            logContext
          );
          this.cacheMissCounter.inc({ operation: 'get' });
          return;
        }
        fileMetadata = metadata;
        this.cacheMissCounter.inc({ operation: 'get' });
      }

      if (!this.providers[fileMetadata.storageType]) {
        throw new StorageOperationException(
          `Unsupported storage type: ${fileMetadata.storageType}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
          logContext
        );
      }
      const provider = this.providers[fileMetadata.storageType];

      await this.deleteWithCircuitBreaker(
        provider,
        fileMetadata.path,
        logContext
      );
      await this.prismaService.fileMetadata.delete({ where: { id: fileId } });
      this.cache.del(`file:${fileId}`);

      if (this.adminEmail) {
        const notifications =
          this.notificationCache.get<string[]>('deleteNotifications') || [];
        if (notifications.length < this.maxNotificationsPerType) {
          notifications.push(
            `File ${fileMetadata.fileName} (ID: ${fileId}) deleted from ${fileMetadata.storageType}`
          );
          this.notificationCache.set('deleteNotifications', notifications);
        } else {
          this.logger.warn('Delete notifications limit reached', logContext);
        }
      }

      const duration = performance.now() - startTime;
      this.logger.log(`File deleted successfully`, {
        ...logContext,
        duration: `${duration.toFixed(2)}ms`,
      });

      end({ success: 'true' });
    } catch (error) {
      this.errorCounter.inc({
        operation: 'delete',
        storage_type: this.storageType,
      });
      end({ success: 'false' });

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`File deletion failed: ${errorMessage}`, logContext);

      if (error instanceof StorageOperationException && this.adminEmail) {
        await this.sendNotificationEmail(
          {
            from: {
              name: 'GMF Aeroasia',
              address: this.configService.get<string>('MAIL_USER')!,
            },
            recipients: [{ name: 'Admin', address: this.adminEmail }],
            subject: `Delete Failed: File ID ${fileId}`,
            template: 'operation-failure',
            context: { fileId, operation: 'delete', errorMessage },
          },
          logContext,
          `delete_error:${fileId}`
        );
      }

      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `File deletion failed: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Validates input for file upload with content-based MIME type checking.
   * @param file Multer file to validate.
   * @param participantId UUID of the participant.
   * @param subfolder Storage subfolder.
   * @param logContext Logging context for tracking.
   */
  private async validateUploadInput(
    file: Express.Multer.File,
    participantId: string,
    subfolder: string,
    logContext: LogContext
  ): Promise<void> {
    if (!file || !file.buffer) {
      this.logger.error('No file provided', logContext);
      throw new FileValidationException('No file provided', logContext);
    }

    if (!isUUID(participantId)) {
      this.logger.error(`Invalid participantId: ${participantId}`, logContext);
      throw new FileValidationException('Invalid participant ID', logContext);
    }

    const participant = await this.prismaService.participant.findUnique({
      where: { id: participantId },
      select: {
        id: true,
        name: true,
        nik: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        idNumber: true,
        dinas: true,
        bidang: true,
        company: true,
        phoneNumber: true,
        nationality: true,
        placeOfBirth: true,
        dateOfBirth: true,
        qrCodeLink: true,
        tglKeluarSuratSehatButaWarna: true,
        tglKeluarSuratBebasNarkoba: true,
        gmfNonGmf: true,
      },
    });
    if (!participant) {
      this.logger.error(`Participant not found: ${participantId}`, logContext);
      throw new FileValidationException('Participant not found', logContext);
    }

    const subfolderRegex = /^[a-zA-Z0-9-_]{1,50}$/;
    const sanitizedSubfolder = sanitizePath(subfolder);
    if (
      !subfolderRegex.test(subfolder) ||
      sanitizedSubfolder !== subfolder ||
      !this.subfolderRelations[subfolder]
    ) {
      this.logger.error(`Invalid subfolder: ${subfolder}`, logContext);
      throw new FileValidationException(
        `Invalid subfolder: ${subfolder}. Must be one of ${Object.keys(this.subfolderRelations).join(', ')}`,
        logContext
      );
    }

    let verifiedMimeType = file.mimetype;
    try {
      const fileTypeResult = await fileTypeFromBuffer(file.buffer);
      verifiedMimeType = fileTypeResult?.mime || file.mimetype;
    } catch (error) {
      this.logger.warn(
        `Failed to detect file type: ${error instanceof Error ? error.message : 'Unknown error'}`,
        logContext
      );
    }

    if (!this.allowedMimeTypes.includes(verifiedMimeType)) {
      this.logger.error(`Invalid MIME type: ${verifiedMimeType}`, logContext);
      throw new FileValidationException(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
        { ...logContext, verifiedMimeType }
      );
    }

    if (file.size > this.maxFileSize) {
      this.logger.error(
        `File size exceeds limit: ${file.size} bytes`,
        logContext
      );
      throw new FileValidationException(
        `File size exceeds limit of ${this.maxFileSize / 1024 / 1024}MB`,
        { ...logContext, fileSize: file.size }
      );
    }
  }

  /**
   * Sanitizes a file name to prevent path traversal attacks.
   * @param fileName Original file name.
   * @returns Sanitized file name.
   */
  private sanitizeFileName(fileName: string): string {
    const sanitized = sanitizePath(fileName, { replacement: '_' });
    const fileNameRegex = /^[a-zA-Z0-9-_.]{1,255}$/;
    if (!fileNameRegex.test(sanitized)) {
      this.logger.warn(`Invalid file name after sanitization: ${sanitized}`);
      return `file_${Date.now()}.bin`;
    }
    return sanitized;
  }

  /**
   * Encrypts a file asynchronously using AES-256-CBC in a worker thread.
   * @param buffer File buffer to encrypt.
   * @param logContext Logging context for tracking.
   * @returns Object containing the encrypted buffer and initialization vector (IV).
   */
  private async encryptFileAsync(
    buffer: Buffer,
    logContext: LogContext
  ): Promise<{ encrypted: Buffer; iv: string }> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        path.resolve(__dirname, './workers/encryption.worker.ts'),
        {
          workerData: {
            buffer,
            key: this.configService.get<string>('ENCRYPTION_KEY'),
          },
        }
      );

      worker.on('message', result => {
        if (result.error) {
          this.logger.error(`Encryption failed: ${result.error}`, logContext);
          this.errorCounter.inc({
            operation: 'encryption',
            storage_type: this.storageType,
          });
          reject(
            new StorageOperationException(
              `File encryption failed: ${result.error}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
              logContext
            )
          );
        } else {
          resolve({ encrypted: Buffer.from(result.encrypted), iv: result.iv });
        }
      });

      worker.on('error', (error: Error) => {
        this.logger.error(
          `Encryption worker error: ${error.message}`,
          logContext
        );
        this.errorCounter.inc({
          operation: 'encryption',
          storage_type: this.storageType,
        });
        reject(
          new StorageOperationException(
            `File encryption failed: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          )
        );
      });

      worker.on('exit', (code: number) => {
        if (code !== 0) {
          this.logger.error(
            `Encryption worker exited with code ${code}`,
            logContext
          );
          this.errorCounter.inc({
            operation: 'encryption',
            storage_type: this.storageType,
          });
          reject(
            new StorageOperationException(
              `Encryption worker failed with code ${code}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
              logContext
            )
          );
        }
      });
    });
  }

  /**
   * Decrypts a file asynchronously using AES-256-CBC in a worker thread.
   * @param buffer Encrypted file buffer.
   * @param iv Initialization vector in hex format.
   * @param logContext Logging context for tracking.
   * @returns Decrypted buffer.
   */
  private async decryptFileAsync(
    buffer: Buffer,
    iv: string,
    logContext: LogContext
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        path.resolve(__dirname, './workers/encryption.worker.ts'),
        {
          workerData: {
            buffer,
            key: this.configService.get<string>('ENCRYPTION_KEY'),
            iv,
            decrypt: true,
          },
        }
      );

      worker.on('message', result => {
        if (result.error) {
          this.logger.error(`Decryption failed: ${result.error}`, logContext);
          this.errorCounter.inc({
            operation: 'decryption',
            storage_type: this.storageType,
          });
          this.sendNotificationEmail(
            {
              from: {
                name: 'GMF Aeroasia',
                address: this.configService.get<string>('MAIL_USER')!,
              },
              recipients: [{ name: 'Admin', address: this.adminEmail! }],
              subject: `Decryption Failed: File ID ${logContext.fileId}`,
              template: 'operation-failure',
              context: {
                fileId: logContext.fileId,
                operation: 'decryption',
                errorMessage: result.error,
              },
            },
            logContext,
            `decryption_error:${logContext.fileId}`
          ).catch(emailError => {
            this.logger.error(
              `Failed to send decryption error notification: ${emailError.message}`,
              logContext
            );
          });
          reject(
            new StorageOperationException(
              `File decryption failed: ${result.error}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
              logContext
            )
          );
        } else {
          resolve(Buffer.from(result.decrypted));
        }
      });

      worker.on('error', (error: Error) => {
        this.logger.error(
          `Decryption worker error: ${error.message}`,
          logContext
        );
        this.errorCounter.inc({
          operation: 'decryption',
          storage_type: this.storageType,
        });
        this.sendNotificationEmail(
          {
            from: {
              name: 'GMF Aeroasia',
              address: this.configService.get<string>('MAIL_USER')!,
            },
            recipients: [{ name: 'Admin', address: this.adminEmail! }],
            subject: `Decryption Failed: File ID ${logContext.fileId}`,
            template: 'operation-failure',
            context: {
              fileId: logContext.fileId,
              operation: 'decryption',
              errorMessage: error.message,
            },
          },
          logContext,
          `decryption_error:${logContext.fileId}`
        ).catch(emailError => {
          this.logger.error(
            `Failed to send decryption error notification: ${emailError.message}`,
            logContext
          );
        });
        reject(
          new StorageOperationException(
            `File decryption failed: ${error.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          )
        );
      });

      worker.on('exit', (code: number) => {
        if (code !== 0) {
          this.logger.error(
            `Decryption worker exited with code ${code}`,
            logContext
          );
          this.errorCounter.inc({
            operation: 'decryption',
            storage_type: this.storageType,
          });
          this.sendNotificationEmail(
            {
              from: {
                name: 'GMF Aeroasia',
                address: this.configService.get<string>('MAIL_USER')!,
              },
              recipients: [{ name: 'Admin', address: this.adminEmail! }],
              subject: `Decryption Failed: File ID ${logContext.fileId}`,
              template: 'operation-failure',
              context: {
                fileId: logContext.fileId,
                operation: 'decryption',
                errorMessage: `Worker exited with code ${code}`,
              },
            },
            logContext,
            `decryption_error:${logContext.fileId}`
          ).catch(emailError => {
            this.logger.error(
              `Failed to send decryption error notification: ${emailError.message}`,
              logContext
            );
          });
          reject(
            new StorageOperationException(
              `Decryption worker failed with code ${code}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
              logContext
            )
          );
        }
      });
    });
  }

  /**
   * Retries sending an email with exponential backoff.
   * @param email Email data to send.
   * @param retries Number of retry attempts (default: 3).
   */
  private async retryEmail(
    email: SendEmail,
    retries: number = 3
  ): Promise<void> {
    await retry(
      async () => {
        await this.mailService.sendEmail(email);
      },
      {
        retries,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onRetry: (error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Retrying email send due to: ${errorMessage}`);
          this.errorCounter.inc({
            operation: 'send_email',
            storage_type: this.storageType,
          });
        },
      }
    );
  }

  /**
   * Uploads a file using circuit breaker for external providers.
   * @param provider Storage provider.
   * @param file Multer file to upload.
   * @param fileName File name in storage.
   * @param logContext Logging context for tracking.
   * @returns File path in storage.
   */
  private async uploadWithCircuitBreaker(
    provider: StorageProvider,
    file: Express.Multer.File,
    fileName: string,
    logContext: LogContext
  ): Promise<string> {
    const providerKey =
      Object.keys(this.providers).find(
        key => this.providers[key] === provider
      ) || this.storageType;
    if (this.circuitBreakers[providerKey as keyof CircuitBreakerMap]) {
      return await this.circuitBreakers[
        providerKey as keyof CircuitBreakerMap
      ]!.upload.fire(file, fileName, logContext.requestId);
    }
    return await this.uploadWithRetry(provider, file, fileName, 3, logContext);
  }

  /**
   * Downloads a file using circuit breaker for external providers.
   * @param provider Storage provider.
   * @param filePath File path in storage.
   * @param logContext Logging context for tracking.
   * @returns Object containing file buffer and MIME type.
   */
  private async downloadWithCircuitBreaker(
    provider: StorageProvider,
    filePath: string,
    logContext: LogContext
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const providerKey =
      Object.keys(this.providers).find(
        key => this.providers[key] === provider
      ) || this.storageType;
    if (this.circuitBreakers[providerKey as keyof CircuitBreakerMap]) {
      return await this.circuitBreakers[
        providerKey as keyof CircuitBreakerMap
      ]!.download.fire(filePath, logContext.requestId);
    }
    return await provider.download(filePath, logContext.requestId);
  }

  /**
   * Deletes a file using circuit breaker for external providers.
   * @param provider Storage provider.
   * @param filePath File path in storage.
   * @param logContext Logging context for tracking.
   */
  private async deleteWithCircuitBreaker(
    provider: StorageProvider,
    filePath: string,
    logContext: LogContext
  ): Promise<void> {
    const providerKey =
      Object.keys(this.providers).find(
        key => this.providers[key] === provider
      ) || this.storageType;
    if (this.circuitBreakers[providerKey as keyof CircuitBreakerMap]) {
      await this.circuitBreakers[
        providerKey as keyof CircuitBreakerMap
      ]!.delete.fire(filePath, logContext.requestId);
      return;
    }
    return await provider.delete(filePath, logContext.requestId);
  }

  /**
   * Uploads a file with an exponential backoff retry mechanism.
   * @param provider Storage provider.
   * @param file Multer file to upload.
   * @param fileName File name in storage.
   * @param maxRetries Maximum number of retry attempts.
   * @param logContext Logging context for tracking.
   * @returns File path in storage.
   */
  private async uploadWithRetry(
    provider: StorageProvider,
    file: Express.Multer.File,
    fileName: string,
    maxRetries: number,
    logContext: LogContext
  ): Promise<string> {
    return retry(
      async () => {
        return await provider.upload(file, fileName, logContext.requestId);
      },
      {
        retries: maxRetries,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
        onRetry: (error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Retrying upload due to: ${errorMessage}`,
            logContext
          );
          this.errorCounter.inc({
            operation: 'upload',
            storage_type: this.storageType,
          });
        },
      }
    );
  }

  /**
   * Sends a daily summary email of notifications using an EJS template.
   * @cron Runs every day at midnight.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async sendDailyNotificationSummary() {
    if (!this.adminEmail) {
      this.logger.warn(
        'Cannot send daily summary: MAIL_ADMIN_NOTIFY not configured'
      );
      return;
    }

    const sensitiveNotifications =
      this.notificationCache.get<string[]>('sensitiveNotifications') || [];
    const failureNotifications =
      this.notificationCache.get<string[]>('failureNotifications') || [];
    const deleteNotifications =
      this.notificationCache.get<string[]>('deleteNotifications') || [];

    if (
      sensitiveNotifications.length === 0 &&
      failureNotifications.length === 0 &&
      deleteNotifications.length === 0
    ) {
      this.logger.log(
        'No sensitive uploads, failures, or deletions to report in daily summary'
      );
      return;
    }

    const mailUser = this.configService.get<string>('MAIL_USER');
    const appName = this.configService.get<string>('APP_NAME', 'GMF Aeroasia');
    if (!mailUser) {
      this.logger.error('Cannot send daily summary: MAIL_USER not configured');
      return;
    }

    try {
      await this.retryEmail({
        from: {
          name: appName,
          address: mailUser,
        },
        recipients: [{ name: 'Admin', address: this.adminEmail }],
        subject: 'Daily File Upload Notification Summary',
        template: 'daily-notification-summary',
        context: {
          sensitiveNotifications,
          failureNotifications,
          deleteNotifications,
          date: new Date().toLocaleDateString('id-ID', { dateStyle: 'full' }),
          hasSensitive: sensitiveNotifications.length > 0,
          hasFailures: failureNotifications.length > 0,
          hasDeletions: deleteNotifications.length > 0,
        },
      });
      this.logger.log('Daily notification summary sent successfully');
      this.notificationCache.del([
        'sensitiveNotifications',
        'failureNotifications',
        'deleteNotifications',
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send daily notification summary: ${errorMessage}`
      );
      this.errorCounter.inc({
        operation: 'send_notification',
        storage_type: this.storageType,
      });
    }
  }

  /**
   * Periodically cleans up orphaned files in batches (every day at midnight).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOrphanedFiles(): Promise<void> {
    const logContext: LogContext = { operation: 'cleanupOrphanedFiles' };
    this.logger.log('Starting orphaned files cleanup', logContext);

    try {
      const files = await this.prismaService.fileMetadata.findMany();
      const batchSize = 100;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async file => {
            const provider =
              this.providers[file.storageType] ||
              this.providers[this.storageType];
            if (!provider) {
              this.logger.error(
                `No provider found for storage type: ${file.storageType}`,
                logContext
              );
              this.errorCounter.inc({
                operation: 'cleanup',
                storage_type: file.storageType,
              });
              return { file, status: 'failed' };
            }
            try {
              // Use provider-specific metadata check if available
              if (provider.checkExists) {
                const exists = await provider.checkExists(
                  file.path,
                  logContext.requestId
                );
                if (!exists) {
                  throw new Error('File not found');
                }
              } else {
                await this.downloadWithCircuitBreaker(
                  provider,
                  file.path,
                  logContext
                );
              }
              return { file, status: 'exists' };
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              this.logger.warn(
                `File ${file.path} not found in storage, marking for deletion: ${errorMessage}`,
                logContext
              );
              await this.prismaService.fileMetadata.delete({
                where: { id: file.id },
              });
              this.cache.del(`file:${file.id}`);
              this.errorCounter.inc({
                operation: 'cleanup',
                storage_type: file.storageType,
              });
              return { file, status: 'deleted' };
            }
          })
        );

        // Log batch results
        const deletedFiles = results.filter(
          r => r.status === 'fulfilled' && r.value.status === 'deleted'
        ).length;
        this.logger.log(
          `Processed batch of ${batch.length} files, deleted ${deletedFiles} orphaned files`,
          logContext
        );
      }

      this.logger.log('Orphaned files cleanup completed', logContext);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Orphaned files cleanup failed: ${errorMessage}`,
        logContext
      );
      this.errorCounter.inc({
        operation: 'cleanup',
        storage_type: this.storageType,
      });
    }
  }

  /**
   * Checks the health of storage providers and database.
   * @returns Object with provider and database status.
   */
  async checkHealth(): Promise<{
    providers: { [key: string]: boolean };
    database: boolean;
  }> {
    const providerStatus: { [key: string]: boolean } = {};
    for (const [key, provider] of Object.entries(this.providers)) {
      try {
        // Use provider-specific health check if available
        if (provider.checkHealth) {
          await provider.checkHealth();
        } else {
          // Fallback to test upload and delete
          const testFile = {
            buffer: Buffer.from('health-check'),
            originalname: `health-check-${Date.now()}.txt`,
            mimetype: 'text/plain',
            size: 12,
          } as Express.Multer.File;
          const testPath = `health-check/${testFile.originalname}`;
          await this.uploadWithCircuitBreaker(provider, testFile, testPath, {});
          await this.deleteWithCircuitBreaker(provider, testPath, {});
        }
        providerStatus[key] = true;
      } catch (error) {
        providerStatus[key] = false;
        this.logger.error(
          `Health check failed for provider ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    let dbStatus = false;
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      dbStatus = true;
    } catch (error) {
      this.logger.error(
        `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return { providers: providerStatus, database: dbStatus };
  }
}
