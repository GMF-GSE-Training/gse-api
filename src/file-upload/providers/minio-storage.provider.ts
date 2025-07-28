import { Client } from 'minio';
import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider } from '../storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements StorageProvider {
  private client: Client;
  private bucket: string;
  private logger = new Logger(MinioStorageProvider.name);

  constructor(options: { endPoint: string; port: number; useSSL: boolean; accessKey: string; secretKey: string; bucket: string }) {
    this.client = new Client({
      endPoint: options.endPoint,
      port: options.port,
      useSSL: options.useSSL,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
    });
    this.bucket = options.bucket;
    
    // Initialize bucket if not exists
    this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (error: any) {
      this.logger.warn(`Could not ensure bucket exists: ${error.message}`);
    }
  }

  async upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string> {
    this.logger.log(`Uploading file to MinIO: ${fileName}`, requestId);
    
    try {
      // Validate input parameters
      if (!file || !file.buffer) {
        throw new Error('Invalid file object: missing buffer');
      }
      
      if (!Buffer.isBuffer(file.buffer)) {
        throw new Error('Invalid file buffer: not a Buffer instance');
      }
      
      if (!fileName || typeof fileName !== 'string') {
        throw new Error('Invalid fileName: must be a non-empty string');
      }
      
      // Normalize file path for cross-platform compatibility
      const normalizedFileName = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
      
      // Prepare metadata
      const metadata = {
        'Content-Type': file.mimetype || 'application/octet-stream',
        'X-Amz-Meta-Original-Name': file.originalname || 'unknown',
        'X-Amz-Meta-Upload-Date': new Date().toISOString(),
        'X-Amz-Meta-Platform': process.platform,
        'X-Amz-Meta-Request-Id': requestId || 'unknown'
      };
      
      this.logger.debug(`MinIO upload attempt:`, {
        fileName: normalizedFileName,
        bufferSize: file.buffer.length,
        contentType: metadata['Content-Type'],
        platform: process.platform,
        requestId
      });
      
      // Perform upload with proper parameters
      const uploadInfo = await this.client.putObject(
        this.bucket,
        normalizedFileName,
        file.buffer,
        file.buffer.length, // Use actual buffer length
        metadata
      );
      
      this.logger.log(`File uploaded successfully to MinIO: ${normalizedFileName}`, {
        etag: uploadInfo.etag,
        versionId: uploadInfo.versionId,
        requestId
      });
      
      return normalizedFileName;
      
    } catch (error: any) {
      this.logger.error(`MinIO upload failed:`, {
        error: error.message,
        code: error.code,
        fileName,
        fileSize: file?.buffer?.length,
        platform: process.platform,
        requestId
      });
      
      // Re-throw with enhanced error message
      throw new Error(`MinIO upload failed: ${error.message}`);
    }
  }

  async download(filePath: string, requestId?: string): Promise<{ buffer: Buffer; mimeType: string }> {
    this.logger.log(`Mencoba download file dari Minio: ${filePath}`, requestId);
    try {
      const stream = await this.client.getObject(this.bucket, filePath);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      if (chunks.length === 0) {
        this.logger.error(`File ditemukan tapi buffer kosong: ${filePath}`, requestId);
        throw new Error('File buffer kosong');
      }
      // TODO: Ambil mimeType dari metadata jika perlu
      return { buffer: Buffer.concat(chunks), mimeType: 'application/octet-stream' };
    } catch (err: any) {
      if (err.code === 'NoSuchKey' || err.message?.includes('not found')) {
        this.logger.warn(`File tidak ditemukan di Minio: ${filePath}`, requestId);
        // Lempar error 404 agar tidak jadi 500
        const notFoundError: any = new Error('File tidak ditemukan di Minio');
        notFoundError.status = 404;
        throw notFoundError;
      }
      this.logger.error(`Gagal download file dari Minio: ${filePath} | Error: ${err?.message || err}`, requestId);
      throw err;
    }
  }

  async delete(filePath: string, requestId?: string): Promise<void> {
    await this.client.removeObject(this.bucket, filePath);
  }

  async exists(filePath: string, requestId?: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number, requestId?: string): Promise<string> {
    this.logger.log(`Generating signed URL for Minio: ${filePath}`, requestId);
    return this.client.presignedGetObject(this.bucket, filePath, expiresIn);
  }

  getPublicUrl(filePath: string, bucketOverride?: string): string {
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const bucket = bucketOverride || this.bucket;
    return `${protocol}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucket}/${filePath}`;
  }
} 