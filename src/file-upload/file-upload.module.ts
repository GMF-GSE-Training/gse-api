import { Module, Provider } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { MinioStorageProvider } from './providers/minio-storage.provider';
import { FileUploadController } from './file-upload.controller';
import { ConfigService } from '@nestjs/config';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider';

const storageProvider: Provider = {
  provide: 'STORAGE_PROVIDER',
  useFactory: (config: ConfigService) => {
    const storageType = config.get('STORAGE_TYPE', 'minio');
    switch (storageType) {
      case 'supabase':
        return new SupabaseStorageProvider(config);
      case 'minio':
    return new MinioStorageProvider({
          endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
          port: Number(config.get('MINIO_PORT', '9000')),
          useSSL: config.get('MINIO_USE_SSL') === 'true',
          accessKey: config.get('MINIO_ACCESS_KEY', ''),
          secretKey: config.get('MINIO_SECRET_KEY', ''),
          bucket: config.get('MINIO_BUCKET', 'uploads'),
    });
      default:
        throw new Error(`Invalid STORAGE_TYPE: ${storageType}`);
    }
  },
  inject: [ConfigService],
};

@Module({
  controllers: [FileUploadController],
  providers: [storageProvider, FileUploadService],
  exports: [FileUploadService],
})
export class FileUploadModule {} 