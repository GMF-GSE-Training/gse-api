import { Module } from '@nestjs/common';
import { QrCodeService } from './qrcode.service';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [CommonModule],
  providers: [QrCodeService],
  exports: [QrCodeService],
})
export class QrCodeModule {} 