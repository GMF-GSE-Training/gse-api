import { Client } from 'minio';
import { Logger } from '@nestjs/common';
// import { StorageProvider } from '../storage-provider.interface'; // Uncomment jika sudah ada interface

// TODO: Ganti dengan import interface StorageProvider jika sudah tersedia di be-dev
export interface StorageProvider {
  upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string>;
  download(filePath: string, requestId?: string): Promise<{ buffer: Buffer; mimeType: string }>;
  delete(filePath: string, requestId?: string): Promise<void>;
  exists(filePath: string, requestId?: string): Promise<boolean>;
  getSignedUrl(filePath: string, expiresIn: number, requestId?: string): Promise<string>;
  getPublicUrl(filePath: string, bucketOverride?: string): string;
}

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
  }

  async upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string> {
    await this.client.putObject(this.bucket, fileName, file.buffer, file.size, { 'Content-Type': file.mimetype });
    return fileName;
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