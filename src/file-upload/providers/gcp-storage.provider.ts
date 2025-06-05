import { Readable } from 'stream';

import { Injectable, Logger, HttpStatus } from '@nestjs/common';

import { Storage } from '@google-cloud/storage';
import * as mime from 'mime-types';

import {
  FileValidationException,
  StorageOperationException,
} from '../exceptions/file.exceptions.js';
import { StorageProvider } from '../storage-provider.interface.js';

/**
 * GCP storage provider for file operations.
 * @description Handles file upload, download, and deletion on Google Cloud Storage.
 * Supports streaming for large files (>10MB) to optimize memory usage.
 * Implements strict input validation and structured logging.
 */
@Injectable()
export class GcpStorageProvider implements StorageProvider {
  private readonly logger = new Logger(GcpStorageProvider.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly fileNameRegex = /^[a-zA-Z0-9-_.\/]{1,255}$/;
  private readonly multipartThreshold = 10 * 1024 * 1024; // 10MB

  /**
   *
   */
  constructor() {
    const projectId = process.env.GCP_PROJECT_ID;
    const keyFilename = process.env.GCP_KEY_FILE;
    this.bucketName = process.env.GCP_BUCKET_NAME || '';

    if (!projectId || !keyFilename || !this.bucketName) {
      this.logger.error('GCP configuration is incomplete');
      throw new StorageOperationException(
        'GCP configuration is incomplete',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    this.storage = new Storage({ projectId, keyFilename });
  }

  /**
   * Validates file name to prevent path traversal and invalid characters.
   * @param fileName File name or path to validate.
   * @param requestId Optional request ID for logging.
   * @throws FileValidationException If validation fails.
   */
  private validateFileName(fileName: string, requestId?: string): void {
    if (!fileName || !this.fileNameRegex.test(fileName)) {
      const logContext = { requestId, fileName };
      this.logger.error(`Invalid file name: ${fileName}`, logContext);
      throw new FileValidationException(
        'Invalid file name. Use alphanumeric, hyphens, underscores, dots, or slashes only.',
        logContext
      );
    }
  }

  /**
   * Uploads a file to GCP storage.
   * @param file Multer file to upload.
   * @param fileName File name in storage.
   * @param requestId Optional request ID for logging.
   * @returns File path in storage (gs:// URI).
   * @throws FileValidationException If validation fails.
   * @throws StorageOperationException If upload fails.
   */
  async upload(
    file: Express.Multer.File,
    fileName: string,
    requestId?: string
  ): Promise<string> {
    const logContext = { requestId, fileName };
    this.logger.log('Starting GCP upload', logContext);

    try {
      if (!file || !file.buffer) {
        throw new FileValidationException('No file provided', logContext);
      }
      this.validateFileName(fileName, requestId);

      const bucket = this.storage.bucket(this.bucketName);
      const blob = bucket.file(fileName);

      // Use streaming for large files
      if (file.buffer.length > this.multipartThreshold) {
        const stream = Readable.from(file.buffer);
        await new Promise((resolve, reject) => {
          stream
            .pipe(blob.createWriteStream({ contentType: file.mimetype }))
            .on('finish', resolve)
            .on('error', reject);
        });
      } else {
        await blob.save(file.buffer, { contentType: file.mimetype });
      }

      this.logger.log(`File uploaded to GCP: ${fileName}`, logContext);
      return `gs://${this.bucketName}/${fileName}`;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`GCP upload failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to upload to GCP: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Downloads a file from GCP storage.
   * @param filePath File path in storage.
   * @param requestId Optional request ID for logging.
   * @returns Object containing file buffer and MIME type.
   * @throws FileValidationException If file is not found.
   * @throws StorageOperationException If download fails.
   */
  async download(
    filePath: string,
    requestId?: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const logContext = { requestId, filePath };
    this.logger.log('Starting GCP download', logContext);

    try {
      this.validateFileName(filePath, requestId);
      const bucket = this.storage.bucket(this.bucketName);
      const blob = bucket.file(filePath);
      const [buffer] = await blob.download();
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      this.logger.log(`File downloaded: ${filePath}`, logContext);
      return { buffer, mimeType };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`GCP download failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to download from GCP: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Deletes a file from GCP storage.
   * @param filePath File path in storage.
   * @param requestId Optional request ID for logging.
   * @throws StorageOperationException If deletion fails.
   */
  async delete(filePath: string, requestId?: string): Promise<void> {
    const logContext = { requestId, filePath };
    this.logger.log('Starting GCP deletion', logContext);

    try {
      this.validateFileName(filePath, requestId);
      const bucket = this.storage.bucket(this.bucketName);
      const blob = bucket.file(filePath);
      await blob.delete();
      this.logger.log(`File deleted from GCP: ${filePath}`, logContext);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`GCP delete failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      throw new StorageOperationException(
        `Failed to delete from GCP: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }
}
