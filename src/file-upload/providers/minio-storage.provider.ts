import { Client } from 'minio';
// import { StorageProvider } from '../storage-provider.interface'; // Uncomment jika sudah ada interface

// TODO: Ganti dengan import interface StorageProvider jika sudah tersedia di backend
export interface StorageProvider {
  upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string>;
  download(filePath: string, requestId?: string): Promise<{ buffer: Buffer; mimeType: string }>;
  delete(filePath: string, requestId?: string): Promise<void>;
}

export class MinioStorageProvider implements StorageProvider {
  private client: Client;
  private bucket: string;

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
    const stream = await this.client.getObject(this.bucket, filePath);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    // TODO: Ambil mimeType dari metadata jika perlu
    return { buffer: Buffer.concat(chunks), mimeType: 'application/octet-stream' };
  }

  async delete(filePath: string, requestId?: string): Promise<void> {
    await this.client.removeObject(this.bucket, filePath);
  }
} 