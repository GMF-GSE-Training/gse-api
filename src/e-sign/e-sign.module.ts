import { Module } from '@nestjs/common';
import { ESignService } from './e-sign.service';
import { ESignController } from './e-sign.controller';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [FileUploadModule],
  providers: [ESignService],
  controllers: [ESignController],
  exports: [ESignService],
})
export class ESignModule {}
