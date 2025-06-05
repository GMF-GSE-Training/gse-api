import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import RPCClient from '@alicloud/pop-core';
import * as mime from 'mime-types';

import OSS from 'ali-oss';

import {
  FileValidationException,
  StorageOperationException,
} from '../exceptions/file.exceptions.js';
import { StorageProvider } from '../storage-provider.interface.js';

/**
 * Antarmuka untuk respons AssumeRole dari Alibaba Cloud STS.
 */
interface STSAssumeRoleResponse {
  Credentials: {
    AccessKeyId: string;
    AccessKeySecret: string;
    SecurityToken: string;
    Expiration: string;
  };
  RequestId: string;
  AssumedRoleUser: {
    Arn: string;
    AssumedRoleId: string;
  };
}

/**
 * Provider untuk operasi penyimpanan file dengan Alibaba OSS.
 * Mengimplementasikan antarmuka StorageProvider untuk unggah, unduh, dan hapus file.
 * Menggunakan Security Token Service (STS) untuk akses aman dan validasi input ketat.
 * @remarks Pastikan untuk memantau kerentanan dependensi `ali-oss` dan `@alicloud/pop-core` menggunakan alat seperti Dependabot atau Snyk.
 * Pastikan bucket diatur sebagai privat. Token STS diperbarui setiap 15 menit.
 * @example
 * const alibabaProvider = new AlibabaStorageProvider(configService);
 * const url = await alibabaProvider.upload(file, 'documents/example.pdf', 'request-id');
 */
@Injectable()
export class AlibabaStorageProvider implements StorageProvider {
  private readonly logger = new Logger(AlibabaStorageProvider.name);
  private client: OSS;
  private readonly stsClient: RPCClient;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly multipartThreshold: number = 10 * 1024 * 1024;
  private readonly fileNameRegex = /^[a-zA-Z0-9-_.\/]{1,255}$/;

  /**
   * Membuat instance AlibabaStorageProvider.
   * @param configService - Service untuk mengakses variabel lingkungan.
   * @throws StorageOperationException jika konfigurasi Alibaba OSS atau STS tidak lengkap.
   */
  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('ALIBABA_REGION') || '';
    const bucketName =
      this.configService.get<string>('ALIBABA_BUCKET_NAME') || '';
    const accessKeyId =
      this.configService.get<string>('ALIBABA_ACCESS_KEY_ID') || '';
    const accessKeySecret =
      this.configService.get<string>('ALIBABA_ACCESS_KEY_SECRET') || '';
    const stsRoleArn =
      this.configService.get<string>('ALIBABA_STS_ROLE_ARN') || '';
    const stsSessionName =
      this.configService.get<string>('ALIBABA_STS_SESSION_NAME') ||
      'oss-session';

    // Validasi konfigurasi dan tambahkan metadata untuk debugging
    const missingKeys: string[] = [];
    if (!region) missingKeys.push('ALIBABA_REGION');
    if (!bucketName) missingKeys.push('ALIBABA_BUCKET_NAME');
    if (!accessKeyId) missingKeys.push('ALIBABA_ACCESS_KEY_ID');
    if (!accessKeySecret) missingKeys.push('ALIBABA_ACCESS_KEY_SECRET');
    if (!stsRoleArn) missingKeys.push('ALIBABA_STS_ROLE_ARN');

    if (missingKeys.length > 0) {
      const errorMessage = `Missing Alibaba OSS/STS configuration: ${missingKeys.join(', ')}`;
      this.logger.error(errorMessage);
      throw new StorageOperationException(
        errorMessage,
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          missingKeys,
        }
      );
    }

    this.region = region;
    this.bucketName = bucketName;

    this.stsClient = new RPCClient({
      accessKeyId,
      accessKeySecret,
      endpoint: 'https://sts.aliyuncs.com',
      apiVersion: '2015-04-01',
    });

    this.client = new OSS({
      region: this.region,
      bucket: this.bucketName,
      accessKeyId,
      accessKeySecret,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
    });

    // Validate bucket
    this.validateBucket().catch(err => {
      this.logger.error(`Bucket validation failed: ${err.message}`);
      throw new StorageOperationException(
        `Invalid Alibaba OSS bucket: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    });

    this.updateSTSToken(stsRoleArn, stsSessionName).catch(err => {
      this.logger.error(
        `Failed to initialize STS token: ${err.message}`,
        err.stack
      );
      throw new StorageOperationException(
        'Failed to initialize Alibaba OSS with STS',
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          error: err.message,
        }
      );
    });

    setInterval(
      () =>
        this.updateSTSToken(stsRoleArn, stsSessionName).catch(err => {
          this.logger.error(
            `Failed to refresh STS token: ${err.message}`,
            err.stack
          );
        }),
      15 * 60 * 1000
    );
  }

  /**
   * Validates the OSS bucket existence.
   * @throws Error if bucket does not exist or is inaccessible.
   */
  private async validateBucket(): Promise<void> {
    try {
      await this.client.getBucketInfo(this.bucketName);
      this.logger.log(`Validated Alibaba OSS bucket: ${this.bucketName}`);
    } catch (error) {
      throw new Error(
        `Bucket ${this.bucketName} does not exist or is inaccessible`
      );
    }
  }

  /**
   * Memperbarui token STS untuk akses OSS.
   * @param roleArn - ARN dari peran STS.
   * @param sessionName - Nama sesi untuk token STS.
   * @returns Tidak ada nilai kembalian (void).
   * @throws StorageOperationException jika pembaruan token gagal.
   * @private
   */
  private async updateSTSToken(
    roleArn: string,
    sessionName: string
  ): Promise<void> {
    try {
      const response = (await this.stsClient.request('AssumeRole', {
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: 3600,
      })) as STSAssumeRoleResponse;

      const credentials = response.Credentials;
      if (
        !credentials ||
        !credentials.AccessKeyId ||
        !credentials.AccessKeySecret ||
        !credentials.SecurityToken
      ) {
        throw new Error('Invalid STS credentials received');
      }

      this.client = new OSS({
        region: this.region,
        accessKeyId: credentials.AccessKeyId,
        accessKeySecret: credentials.AccessKeySecret,
        stsToken: credentials.SecurityToken,
        bucket: this.bucketName,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
      });
      this.logger.log('STS token updated successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      this.logger.error(
        `Failed to update STS token: ${errorMessage}`,
        errorStack
      );
      throw new StorageOperationException(
        `Failed to update STS token: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        {
          error: errorMessage,
        }
      );
    }
  }

  /**
   * Memvalidasi nama file atau path untuk mencegah serangan path traversal.
   * @param fileName - Nama file atau path yang akan divalidasi.
   * @param requestId - ID permintaan untuk pelacakan (opsional).
   * @returns Tidak ada nilai kembalian (void).
   * @throws FileValidationException jika validasi gagal.
   * @private
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
   * Mengunggah file ke Alibaba OSS.
   * Menggunakan unggah multipart untuk file besar (>10MB) untuk efisiensi.
   * @param file - File yang akan diunggah, diterima dari Multer.
   * @param fileName - Nama file yang diinginkan di OSS.
   * @param requestId - ID permintaan untuk pelacakan (opsional).
   * @returns URL file yang telah diunggah (oss:// URI).
   * @throws FileValidationException jika validasi input gagal.
   * @throws StorageOperationException jika proses unggah gagal.
   */
  async upload(
    file: Express.Multer.File,
    fileName: string,
    requestId?: string
  ): Promise<string> {
    const logContext = { requestId, fileName };
    this.logger.log('Starting Alibaba OSS upload', logContext);

    try {
      if (!file || !file.buffer) {
        throw new FileValidationException('No file provided', logContext);
      }
      this.validateFileName(fileName, requestId);

      if (file.buffer.length > this.multipartThreshold) {
        await this.client.multipartUpload(fileName, file.buffer, {
          mime: file.mimetype,
          progress: (p: number) => {
            this.logger.debug(
              `Multipart upload progress: ${Math.round(p * 100)}%`,
              logContext
            );
          },
        });
        this.logger.log(
          `File uploaded using multipart: ${fileName}`,
          logContext
        );
      } else {
        await this.client.put(fileName, file.buffer, { mime: file.mimetype });
        this.logger.log(`File uploaded: ${fileName}`, logContext);
      }

      return `oss://${this.bucketName}/${fileName}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      const logStack =
        this.configService.get<string>('NODE_ENV') !== 'production'
          ? errorStack
          : undefined;
      this.logger.error(`Alibaba OSS upload failed: ${errorMessage}`, {
        ...logContext,
        stack: logStack,
      });
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to upload to Alibaba OSS: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Mengunduh file dari Alibaba OSS.
   * @param filePath - Path file di OSS.
   * @param requestId - ID permintaan untuk pelacakan (opsional).
   * @returns Objek berisi buffer file dan tipe MIME-nya.
   * @throws FileValidationException jika validasi path gagal.
   * @throws StorageOperationException jika proses unduh gagal.
   */
  async download(
    filePath: string,
    requestId?: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const logContext = { requestId, filePath };
    this.logger.log('Starting Alibaba OSS download', logContext);

    try {
      this.validateFileName(filePath, requestId);
      const result = await this.client.get(filePath);
      if (!result.content) {
        throw new FileValidationException('File not found', logContext);
      }
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      this.logger.log(`File downloaded: ${filePath}`, logContext);
      return { buffer: result.content, mimeType };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      const logStack =
        this.configService.get<string>('NODE_ENV') !== 'production'
          ? errorStack
          : undefined;
      this.logger.error(`Alibaba OSS download failed: ${errorMessage}`, {
        ...logContext,
        stack: logStack,
      });
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to download from Alibaba OSS: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }

  /**
   * Menghapus file dari Alibaba OSS.
   * @param filePath - Path file yang akan dihapus di OSS.
   * @param requestId - ID permintaan untuk pelacakan (opsional).
   * @returns Tidak ada nilai kembalian (void).
   * @throws FileValidationException jika validasi path gagal.
   * @throws StorageOperationException jika proses penghapusan gagal.
   */
  async delete(filePath: string, requestId?: string): Promise<void> {
    const logContext = { requestId, filePath };
    this.logger.log('Starting Alibaba OSS deletion', logContext);

    try {
      this.validateFileName(filePath, requestId);
      await this.client.delete(filePath);
      this.logger.log(`File deleted: ${filePath}`, logContext);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error
          ? error.stack || 'No stack trace'
          : 'No stack trace';
      const logStack =
        this.configService.get<string>('NODE_ENV') !== 'production'
          ? errorStack
          : undefined;
      this.logger.error(`Alibaba OSS delete failed: ${errorMessage}`, {
        ...logContext,
        stack: logStack,
      });
      throw error instanceof FileValidationException ||
        error instanceof StorageOperationException
        ? error
        : new StorageOperationException(
            `Failed to delete from Alibaba OSS: ${errorMessage}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
            logContext
          );
    }
  }
}
