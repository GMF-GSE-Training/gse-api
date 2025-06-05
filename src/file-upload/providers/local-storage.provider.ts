import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

import { Injectable, Logger, HttpStatus, Inject } from '@nestjs/common';

import retry from 'async-retry';
import * as mime from 'mime-types';
import { Histogram, Counter } from 'prom-client';
import sanitizePath from 'sanitize-filename';

import {
  FileValidationException,
  StorageOperationException,
} from '../exceptions/file.exceptions.js';
import {
  PROM_HISTOGRAM_UPLOAD,
  PROM_HISTOGRAM_DOWNLOAD,
  PROM_HISTOGRAM_DELETE,
  PROM_COUNTER_ERRORS,
} from '../metrics.tokens.js';
import { StorageProvider } from '../storage-provider.interface.js';

/**
 *
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;
  private readonly fileNameRegex = /^[a-zA-Z0-9-_.\/]{1,255}$/;
  private readonly multipartThreshold: number;
  private readonly retryOptions = {
    retries: parseInt(process.env.RETRY_COUNT || '3', 10),
    minTimeout: parseInt(process.env.RETRY_MIN_TIMEOUT || '1000', 10),
    maxTimeout: parseInt(process.env.RETRY_MAX_TIMEOUT || '5000', 10),
  };

  /**
   *
   * @param uploadDuration
   * @param downloadDuration
   * @param deleteDuration
   * @param errorCounter
   */
  constructor(
    @Inject(PROM_HISTOGRAM_UPLOAD)
    private readonly uploadDuration: Histogram<string>,
    @Inject(PROM_HISTOGRAM_DOWNLOAD)
    private readonly downloadDuration: Histogram<string>,
    @Inject(PROM_HISTOGRAM_DELETE)
    private readonly deleteDuration: Histogram<string>,
    @Inject(PROM_COUNTER_ERRORS) private readonly errorCounter: Counter<string>
  ) {
    this.basePath = process.env.UPLOADS_PATH || './Uploads';
    this.multipartThreshold =
      parseInt(process.env.MULTIPART_THRESHOLD_MB || '10', 10) * 1024 * 1024;

    if (!this.basePath || this.basePath.trim() === '') {
      this.logger.error('UPLOADS_PATH is not configured or empty', {
        operation: 'constructor',
      });
      throw new StorageOperationException(
        'Local storage configuration is incomplete or invalid',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    if (!path.isAbsolute(path.resolve(this.basePath))) {
      this.logger.error('UPLOADS_PATH is not an absolute path', {
        operation: 'constructor',
      });
      throw new StorageOperationException(
        'Local storage configuration is incomplete or invalid',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    if (!fs.existsSync(this.basePath)) {
      try {
        fs.mkdirSync(this.basePath, { recursive: true, mode: 0o700 });
        this.logger.log(
          `Created uploads directory with secure permissions: ${this.basePath}`,
          { operation: 'constructor' }
        );
        fs.accessSync(this.basePath, fs.constants.W_OK);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to create or verify uploads directory: ${errorMessage}`,
          { operation: 'constructor' }
        );
        throw new StorageOperationException(
          'Failed to initialize uploads directory',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }

  /**
   *
   * @param fileName
   * @param requestId
   */
  private validateAndSanitizePath(
    fileName: string,
    requestId?: string
  ): string {
    const logContext = { requestId, fileName, operation: 'validate' };
    if (!fileName) {
      this.logger.error('File name is empty', logContext);
      throw new FileValidationException(
        'File name cannot be empty',
        logContext
      );
    }

    const sanitized = sanitizePath(fileName, { replacement: '' });
    if (sanitized === '') {
      this.logger.error(
        `File name cannot be empty after sanitization: ${fileName}`,
        logContext
      );
      throw new FileValidationException(
        'File name cannot be empty after sanitization',
        logContext
      );
    }

    if (
      !this.fileNameRegex.test(sanitized) ||
      sanitized.startsWith('/') ||
      sanitized.includes('..')
    ) {
      this.logger.error(
        `Invalid file name format or path traversal detected: ${fileName}`,
        logContext
      );
      throw new FileValidationException(
        'Invalid file name. Use alphanumeric, hyphens, underscores, dots, or slashes only, and avoid absolute paths or path traversal.',
        logContext
      );
    }

    const absolutePath = path.resolve(path.join(this.basePath, sanitized));
    const allowedRoot = path.resolve(this.basePath);
    if (!absolutePath.startsWith(allowedRoot)) {
      this.logger.error(
        `Path traversal attempt detected: ${absolutePath}`,
        logContext
      );
      throw new FileValidationException(
        'Path traversal attempt detected',
        logContext
      );
    }

    return absolutePath;
  }

  /**
   *
   * @param operation
   * @param operationName
   * @param logContext
   * @param maxRetries
   */
  private async retryFileOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    logContext: any,
    maxRetries = parseInt(process.env.RETRY_COUNT || '3', 10)
  ): Promise<T> {
    return retry(
      async () => {
        return await operation();
      },
      {
        retries: maxRetries,
        minTimeout: this.retryOptions.minTimeout,
        maxTimeout: this.retryOptions.maxTimeout,
        onRetry: (error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Retrying ${operationName} due to: ${errorMessage}`,
            logContext
          );
        },
      }
    );
  }

  /**
   *
   * @param file
   * @param fileName
   * @param requestId
   */
  async upload(
    file: Express.Multer.File,
    fileName: string,
    requestId?: string
  ): Promise<string> {
    const logContext = {
      requestId,
      fileName,
      fileSize: file?.size,
      operation: 'upload',
    };
    const end = this.uploadDuration.startTimer();
    this.logger.log('Starting local upload', logContext);

    try {
      if (!file || !file.buffer) {
        throw new FileValidationException('No file provided', logContext);
      }

      const fullPath = this.validateAndSanitizePath(fileName, requestId);
      const dir = path.dirname(fullPath);

      try {
        await this.retryFileOperation(
          () => fs.promises.access(fullPath, fs.constants.F_OK),
          'file access',
          logContext
        );
        this.logger.error(`File already exists: ${fullPath}`, logContext);
        throw new FileValidationException('File already exists', logContext);
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          'code' in error &&
          error['code'] === 'ENOENT'
        ) {
          // File tidak ada, lanjutkan
        } else {
          throw error;
        }
      }

      if (!fs.existsSync(dir)) {
        await this.retryFileOperation(
          async () => {
            await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
            await fs.promises.access(dir, fs.constants.W_OK);
          },
          'directory creation',
          logContext
        );
        this.logger.log(
          `Created directory with secure permissions: ${dir}`,
          logContext
        );
      }

      await this.retryFileOperation(
        async () => {
          if (file.buffer.length > this.multipartThreshold) {
            const writeStream = fs.createWriteStream(fullPath, { mode: 0o600 });
            const readableStream = Readable.from(file.buffer);
            let uploadedBytes = 0;
            readableStream.on('data', (chunk: Buffer) => {
              uploadedBytes += chunk.length;
              this.logger.debug(
                `Upload progress: ${Math.round((uploadedBytes / file.buffer.length) * 100)}%`,
                logContext
              );
            });
            await new Promise<void>((resolve, reject) => {
              readableStream
                .pipe(writeStream)
                .on('finish', () => resolve())
                .on('error', error => reject(error));
            });
          } else {
            await fs.promises.writeFile(fullPath, file.buffer, { mode: 0o600 });
          }
        },
        'file write',
        logContext
      );

      this.logger.log(
        `File uploaded to local storage: ${fullPath}`,
        logContext
      );
      end({ success: 'true' });
      return fullPath;
    } catch (error: unknown) {
      this.errorCounter.inc({ operation: 'upload' });
      end({ success: 'false' });
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`Local upload failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });

      if (
        error instanceof FileValidationException ||
        error instanceof StorageOperationException
      ) {
        throw error;
      }
      if (error instanceof Error && 'code' in error) {
        if (error['code'] === 'EACCES') {
          throw new StorageOperationException(
            'Permission denied during file upload',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'ENOSPC') {
          throw new StorageOperationException(
            'Disk full during file upload',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EBUSY') {
          throw new StorageOperationException(
            'File is busy or locked during upload',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EIO') {
          throw new StorageOperationException(
            'I/O error during file upload',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
      }
      throw new StorageOperationException(
        `Failed to upload to local storage: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }

  /**
   *
   * @param filePath
   * @param requestId
   */
  async download(
    filePath: string,
    requestId?: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const logContext = { requestId, filePath, operation: 'download' };
    const end = this.downloadDuration.startTimer();
    this.logger.log('Starting local download', logContext);

    try {
      const fullPath = this.validateAndSanitizePath(filePath, requestId);
      await this.retryFileOperation(
        () => fs.promises.access(fullPath, fs.constants.R_OK),
        'file access',
        logContext
      );
      const buffer = await this.retryFileOperation(
        () => fs.promises.readFile(fullPath),
        'file read',
        logContext
      );
      const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
      this.logger.log(`File downloaded: ${fullPath}`, logContext);
      end({ success: 'true' });
      return { buffer, mimeType };
    } catch (error: unknown) {
      this.errorCounter.inc({ operation: 'download' });
      end({ success: 'false' });
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`Local download failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });

      if (
        error instanceof Error &&
        'code' in error &&
        error['code'] === 'ENOENT'
      ) {
        throw new FileValidationException('File not found', logContext);
      }
      if (
        error instanceof FileValidationException ||
        error instanceof StorageOperationException
      ) {
        throw error;
      }
      if (error instanceof Error && 'code' in error) {
        if (error['code'] === 'EACCES') {
          throw new StorageOperationException(
            'Permission denied during file download',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EBUSY') {
          throw new StorageOperationException(
            'File is busy or locked during download',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EIO') {
          throw new StorageOperationException(
            'I/O error during file download',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
      }
      throw new StorageOperationException(
        `Failed to download from local storage: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }

  /**
   *
   * @param filePath
   * @param requestId
   */
  async delete(filePath: string, requestId?: string): Promise<void> {
    const logContext = { requestId, filePath, operation: 'delete' };
    const end = this.deleteDuration.startTimer();
    this.logger.log('Starting local deletion', logContext);

    try {
      const fullPath = this.validateAndSanitizePath(filePath, requestId);
      try {
        await this.retryFileOperation(
          () => fs.promises.access(fullPath, fs.constants.F_OK),
          'file access',
          logContext
        );
        await this.retryFileOperation(
          () => fs.promises.unlink(fullPath),
          'file delete',
          logContext
        );
        this.logger.log(`File deleted: ${fullPath}`, logContext);
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          'code' in error &&
          error['code'] === 'ENOENT'
        ) {
          this.logger.warn(
            `File not found for deletion: ${fullPath}`,
            logContext
          );
          return;
        }
        throw error;
      }

      let currentDir = path.dirname(fullPath);
      while (
        currentDir !== this.basePath &&
        currentDir.startsWith(this.basePath)
      ) {
        try {
          const files = await fs.promises.readdir(currentDir);
          if (files.length === 0) {
            await this.retryFileOperation(
              () => fs.promises.rmdir(currentDir),
              'directory delete',
              logContext
            );
            this.logger.log(
              `Cleaned up empty directory: ${currentDir}`,
              logContext
            );
          } else {
            break;
          }
          currentDir = path.dirname(currentDir);
        } catch (error: unknown) {
          this.logger.debug(
            `Directory not empty or already removed: ${currentDir}`,
            logContext
          );
          break;
        }
      }

      end({ success: 'true' });
    } catch (error: unknown) {
      this.errorCounter.inc({ operation: 'delete' });
      end({ success: 'false' });
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`Local delete failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });

      if (
        error instanceof FileValidationException ||
        error instanceof StorageOperationException
      ) {
        throw error;
      }
      if (error instanceof Error && 'code' in error) {
        if (error['code'] === 'EACCES') {
          throw new StorageOperationException(
            'Permission denied during file deletion',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EBUSY') {
          throw new StorageOperationException(
            'File is busy or locked during deletion',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EIO') {
          throw new StorageOperationException(
            'I/O error during file deletion',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
      }
      throw new StorageOperationException(
        `Failed to delete from local storage: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }

  /**
   *
   * @param filePath
   * @param requestId
   */
  async checkExists(filePath: string, requestId?: string): Promise<boolean> {
    const logContext = { requestId, filePath, operation: 'checkExists' };
    this.logger.log('Checking file existence', logContext);

    try {
      const fullPath = this.validateAndSanitizePath(filePath, requestId);
      await this.retryFileOperation(
        () => fs.promises.access(fullPath, fs.constants.F_OK),
        'file access',
        logContext
      );
      this.logger.debug(`File exists: ${fullPath}`, logContext);
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error['code'] === 'ENOENT'
      ) {
        this.logger.debug(`File does not exist: ${filePath}`, logContext);
        return false;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`Check exists failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      if (error instanceof FileValidationException) {
        throw error;
      }
      if (error instanceof Error && 'code' in error) {
        if (error['code'] === 'EACCES') {
          throw new StorageOperationException(
            'Permission denied during file existence check',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EBUSY') {
          throw new StorageOperationException(
            'File is busy or locked during existence check',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EIO') {
          throw new StorageOperationException(
            'I/O error during file existence check',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
      }
      throw new StorageOperationException(
        `Failed to check file existence: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }

  /**
   *
   */
  async checkHealth(): Promise<void> {
    const logContext = { operation: 'checkHealth' };
    this.logger.log('Checking local storage health', logContext);

    try {
      const testPath = path.join(
        this.basePath,
        `health-check-${Date.now()}.txt`
      );
      await this.retryFileOperation(
        () => fs.promises.writeFile(testPath, 'test', { mode: 0o600 }),
        'file write',
        logContext
      );
      await this.retryFileOperation(
        () => fs.promises.unlink(testPath),
        'file delete',
        logContext
      );
      this.logger.debug('Local storage health check passed', logContext);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`Health check failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      if (error instanceof Error && 'code' in error) {
        if (error['code'] === 'EACCES') {
          throw new StorageOperationException(
            'Permission denied during health check',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'ENOSPC') {
          throw new StorageOperationException(
            'Disk full during health check',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EBUSY') {
          throw new StorageOperationException(
            'File is busy or locked during health check',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
        if (error['code'] === 'EIO') {
          throw new StorageOperationException(
            'I/O error during health check',
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
        }
      }
      throw new StorageOperationException(
        `Local storage health check failed: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }
}
