import { Module } from '@nestjs/common';

import { CsrfController } from './csrf.controller.js';

/**
 * Modul untuk mengelola fungsi CSRF.
 * @description Mengintegrasikan controller CSRF ke dalam aplikasi.
 */
@Module({
  controllers: [CsrfController],
})
export class CsrfModule {}
