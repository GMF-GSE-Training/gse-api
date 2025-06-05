import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module.js';
import { FileUploadModule } from '../file-upload/file-upload.module.js';

import { ESignController } from './e-sign.controller.js';
import { ESignService } from './e-sign.service.js';

/**
 * Modul untuk mengelola tanda tangan elektronik (e-sign).
 * @description Menyediakan layanan dan kontroler untuk operasi e-sign.
 */
@Module({
  imports: [FileUploadModule, CommonModule],
  providers: [ESignService],
  controllers: [ESignController],
})
export class ESignModule {}
