import { Readable } from 'stream';

import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import retry from 'async-retry';
import * as mime from 'mime-types';
import Client from 'ssh2-sftp-client';

import {
  FileValidationException,
  StorageOperationException,
} from '../exceptions/file.exceptions.js';
import { StorageProvider } from '../storage-provider.interface.js';

/**
 * NAS storage provider using SFTP for file operations.
 * @description Handles file upload, download, and deletion on a NAS device using SFTP protocol.
 * Implements strict input validation, structured logging, connection health checks, and retry logic.
 */
@Injectable()
export class NasStorageProvider implements StorageProvider {
  private readonly logger = new Logger(NasStorageProvider.name);
  private readonly client: Client;
  private readonly basePath: string;
  private readonly fileNameRegex = /^[a-zA-Z0-9-_.\/]{1,255}$/;
  private isConnected: boolean = false;

  /**
   *
   * @param configService
   */
  constructor(private readonly configService: ConfigService) {
    this.basePath = this.configService.get<string>(
      'NAS_BASE_PATH',
      '/nas/uploads'
    );
    const host = this.configService.get<string>('NAS_HOST');
    const port = this.configService.get<number>('NAS_PORT', 22);
    const username = this.configService.get<string>('NAS_USERNAME');
    const password = this.configService.get<string>('NAS_PASSWORD');

    if (!host || !username || !password || !this.basePath) {
      this.logger.error('NAS SFTP configuration incomplete', {
        missing: { host, username, password, basePath: this.basePath },
      });
      throw new StorageOperationException(
        'NAS SFTP configuration is incomplete',
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          missing: { host, username, password, basePath: this.basePath },
        }
      );
    }

    this.client = new Client();
    // Perform connection with retries
    retry(
      async (bail: (e: Error) => void, attempt: number) => {
        this.logger.log(`Attempting SFTP connection (attempt ${attempt})`, {
          host,
          port,
        });
        try {
          await this.client.connect({ host, port, username, password });
          this.isConnected = true;
          this.logger.log(
            `Initialized NAS SFTP provider for host: ${host}, base path: ${this.basePath}`
          );
        } catch (error: any) {
          this.logger.error(
            `SFTP connection attempt ${attempt} failed: ${error.message}`,
            { stack: error.stack }
          );
          // Bail on permanent errors (e.g., authentication failure)
          if (error.code === 'EAUTH' || error.code === 'EPERM') {
            bail(
              new StorageOperationException(
                `Permanent SFTP connection failure: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
              )
            );
            return;
          }
          throw error; // Retry on transient errors
        }
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 2000,
        onRetry: (error: Error) =>
          this.logger.warn(`Retrying SFTP connection due to: ${error.message}`),
      }
    ).catch((error: Error) => {
      this.logger.error(`Failed to initialize SFTP client: ${error.message}`, {
        stack: error.stack,
      });
      throw new StorageOperationException(
        `Failed to initialize NAS SFTP client: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    });
  }

  /**
   * Validates SFTP connection health and reconnects if necessary.
   * @param requestId Optional request ID for logging.
   * @throws StorageOperationException If connection fails.
   */
  private async checkConnectionHealth(requestId?: string): Promise<void> {
    const logContext = { requestId, operation: 'checkConnectionHealth' };
    this.logger.log('Checking SFTP connection health', logContext);

    if (!this.isConnected) {
      this.logger.warn(
        'SFTP connection not established, attempting to reconnect',
        logContext
      );
      await this.reconnect(logContext);
    }

    try {
      await this.client.list(this.basePath);
      this.logger.log('SFTP connection validated successfully', logContext);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `SFTP connection check failed: ${errorMessage}`,
        logContext
      );
      this.isConnected = false;
      throw new StorageOperationException(
        `SFTP connection validation failed: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }

  /**
   * Attempts to reconnect to the SFTP server.
   * @param logContext Context for logging.
   */
  private async reconnect(logContext: Record<string, any>): Promise<void> {
    try {
      const host = this.configService.get<string>('NAS_HOST')!;
      const port = this.configService.get<number>('NAS_PORT', 22);
      const username = this.configService.get<string>('NAS_USERNAME')!;
      const password = this.configService.get<string>('NAS_PASSWORD')!;
      await retry(
        async (bail: (e: Error) => void, attempt: number) => {
          this.logger.log(`Reconnecting SFTP (attempt ${attempt})`, logContext);
          try {
            await this.client.connect({ host, port, username, password });
            this.isConnected = true;
            this.logger.log('SFTP reconnection successful', logContext);
          } catch (error: any) {
            if (error.code === 'EAUTH' || error.code === 'EPERM') {
              bail(
                new StorageOperationException(
                  `Permanent SFTP reconnection failure: ${error.message}`,
                  HttpStatus.INTERNAL_SERVER_ERROR
                )
              );
              return;
            }
            throw error;
          }
        },
        {
          retries: 3,
          factor: 2,
          minTimeout: 2000,
          onRetry: (error: Error) =>
            this.logger.warn(
              `Retrying SFTP reconnection due to: ${error.message}`,
              logContext
            ),
        }
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `SFTP reconnection failed: ${errorMessage}`,
        logContext
      );
      throw new StorageOperationException(
        `Failed to reconnect to NAS SFTP: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }

  /**
   * Validates file name to prevent path traversal or invalid characters.
   * @param fileName Name of the file to validate.
   * @param requestId Optional request ID for logging.
   */
  private validateFileName(fileName: string, requestId?: string): void {
    if (!fileName || !this.fileNameRegex.test(fileName)) {
      this.logger.error(`Invalid file name: ${fileName}`, { requestId });
      throw new FileValidationException(
        'Invalid file name. Use alphanumeric, hyphens, underscores, dots, or slashes only.',
        { requestId }
      );
    }
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
    const logContext = { requestId, fileName, fileSize: file?.size };
    this.logger.log('Starting NAS SFTP upload', logContext);

    try {
      if (!file || !file.buffer) {
        throw new FileValidationException('No file provided', logContext);
      }
      this.validateFileName(fileName, requestId);
      await this.checkConnectionHealth(requestId);

      const remotePath = `${this.basePath}/${fileName}`;
      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
      await this.client.mkdir(remoteDir, true);

      await this.client.put(Readable.from(file.buffer), remotePath);
      this.logger.log(`File uploaded to NAS SFTP: ${remotePath}`, logContext);
      return fileName;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`NAS SFTP upload failed: ${errorMessage}`, logContext);
      this.isConnected = false; // Mark as disconnected on error
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to upload to NAS SFTP: ${errorMessage}`,
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
    const logContext = { requestId, filePath };
    this.logger.log('Starting NAS SFTP download', logContext);

    try {
      this.validateFileName(filePath, requestId);
      await this.checkConnectionHealth(requestId);

      const remotePath = `${this.basePath}/${filePath}`;
      const buffer = await this.client.get(remotePath);
      if (!buffer) {
        throw new FileValidationException('File not found', logContext);
      }

      const resultBuffer =
        buffer instanceof Buffer ? buffer : Buffer.from(buffer as string);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      this.logger.log(
        `File downloaded from NAS SFTP: ${remotePath}`,
        logContext
      );
      return { buffer: resultBuffer, mimeType };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `NAS SFTP download failed: ${errorMessage}`,
        logContext
      );
      this.isConnected = false; // Mark as disconnected on error
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to download from NAS SFTP: ${errorMessage}`,
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
    const logContext = { requestId, filePath };
    this.logger.log('Starting NAS SFTP deletion', logContext);

    try {
      this.validateFileName(filePath, requestId);
      await this.checkConnectionHealth(requestId);

      const remotePath = `${this.basePath}/${filePath}`;
      await this.client.delete(remotePath);
      this.logger.log(`File deleted from NAS SFTP: ${remotePath}`, logContext);

      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf('/'));
      try {
        await this.client.rmdir(remoteDir, true);
        this.logger.log(`Cleaned up empty directory: ${remoteDir}`, logContext);
      } catch (error) {
        this.logger.debug(
          `Directory not empty or already removed: ${remoteDir}`,
          logContext
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `NAS SFTP deletion failed: ${errorMessage}`,
        logContext
      );
      this.isConnected = false; // Mark as disconnected on error
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to delete from NAS SFTP: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Closes the SFTP connection when the provider is destroyed.
   */
  async onModuleDestroy() {
    try {
      if (this.isConnected) {
        await this.client.end();
        this.logger.log('SFTP client connection closed');
        this.isConnected = false;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to close SFTP client: ${errorMessage}`);
    }
  }
}
