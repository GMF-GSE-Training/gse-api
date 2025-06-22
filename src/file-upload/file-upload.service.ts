import { Injectable, Inject } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class FileUploadService {
  constructor(@Inject('STORAGE_PROVIDER') private readonly storageProvider: StorageProvider) {}

  async uploadFile(file: Express.Multer.File, fileName: string): Promise<string> {
    return this.storageProvider.upload(file, fileName);
  }

  async downloadFile(filePath: string): Promise<{ buffer: Buffer; mimeType: string }> {
    return this.storageProvider.download(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    return this.storageProvider.delete(filePath);
  }
} 