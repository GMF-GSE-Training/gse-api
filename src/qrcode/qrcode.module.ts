import { Module } from '@nestjs/common';
import { QrCodeService } from './qrcode.service';
import { CommonModule } from 'src/common/common.module';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [CommonModule, FileUploadModule],
  providers: [QrCodeService],
  exports: [QrCodeService],
})
export class QrCodeModule {} 