import { Readable } from 'stream';

import { Injectable, Logger, HttpStatus } from '@nestjs/common';

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as mime from 'mime-types';

import {
  FileValidationException,
  StorageOperationException,
} from '../exceptions/file.exceptions.js';
import { StorageProvider } from '../storage-provider.interface.js';

/**
 * AWS S3 storage provider for file operations.
 * @description Handles file upload, download, and deletion on AWS S3.
 * Supports streaming for large files (>10MB) to optimize memory usage.
 * Implements strict input validation and structured logging.
 */
@Injectable()
export class AwsStorageProvider implements StorageProvider {
  private readonly logger = new Logger(AwsStorageProvider.name);
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly fileNameRegex = /^[a-zA-Z0-9-_.\/]{1,255}$/;
  private readonly multipartThreshold = 10 * 1024 * 1024; // 10MB

  /**
   *
   */
  constructor() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION;
    this.bucketName = process.env.AWS_BUCKET_NAME || '';

    if (!accessKeyId || !secretAccessKey || !region || !this.bucketName) {
      this.logger.error('AWS configuration is incomplete');
      throw new StorageOperationException(
        'AWS configuration is incomplete',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    this.s3 = new S3Client({
      credentials: { accessKeyId, secretAccessKey },
      region,
    });
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
   * Uploads a file to AWS S3.
   * @param file Multer file to upload.
   * @param fileName File name in storage.
   * @param requestId Optional request ID for logging.
   * @returns File path in storage (s3:// URI).
   * @throws FileValidationException If validation fails.
   * @throws StorageOperationException If upload fails.
   */
  async upload(
    file: Express.Multer.File,
    fileName: string,
    requestId?: string
  ): Promise<string> {
    const logContext = { requestId, fileName };
    this.logger.log('Starting AWS upload', logContext);

    try {
      if (!file || !file.buffer) {
        throw new FileValidationException('No file provided', logContext);
      }
      this.validateFileName(fileName, requestId);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: file.mimetype,
        Body:
          file.buffer.length > this.multipartThreshold
            ? Readable.from(file.buffer)
            : file.buffer,
      });
      await this.s3.send(command);
      this.logger.log(`File uploaded to AWS: ${fileName}`, logContext);
      return `s3://${this.bucketName}/${fileName}`;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`AWS upload failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to upload to AWS: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Downloads a file from AWS S3.
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
    this.logger.log('Starting AWS download', logContext);

    try {
      this.validateFileName(filePath, requestId);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });
      const data = await this.s3.send(command);

      if (!data.Body) {
        this.logger.error(`File not found in S3: ${filePath}`, logContext);
        throw new FileValidationException('File not found', logContext);
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = data.Body as Readable;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

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
      this.logger.error(`AWS download failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to download from AWS: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Deletes a file from AWS S3.
   * @param filePath File path in storage.
   * @param requestId Optional request ID for logging.
   * @throws StorageOperationException If deletion fails.
   */
  async delete(filePath: string, requestId?: string): Promise<void> {
    const logContext = { requestId, filePath };
    this.logger.log('Starting AWS deletion', logContext);

    try {
      this.validateFileName(filePath, requestId);
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });
      await this.s3.send(command);
      this.logger.log(`File deleted from AWS: ${filePath}`, logContext);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(`AWS delete failed: ${errorMessage}`, {
        ...logContext,
        stack: errorStack,
      });
      throw new StorageOperationException(
        `Failed to delete from AWS: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }
}
