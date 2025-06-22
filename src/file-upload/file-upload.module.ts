import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { MinioStorageProvider } from './providers/minio-storage.provider';
import { FileUploadController } from './file-upload.controller';

const minioProvider = {
  provide: 'STORAGE_PROVIDER',
  useFactory: () => {
    return new MinioStorageProvider({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || '',
      secretKey: process.env.MINIO_SECRET_KEY || '',
      bucket: process.env.MINIO_BUCKET || 'files',
    });
  },
};

@Module({
  controllers: [FileUploadController],
  providers: [FileUploadService, minioProvider],
  exports: [FileUploadService],
})
export class FileUploadModule {} 