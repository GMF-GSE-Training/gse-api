import { Module } from '@nestjs/common';

import { CertificateController } from './certificate.controller.js';
import { CertificateService } from './certificate.service.js';

/**
 *
 */
@Module({
  providers: [CertificateService],
  controllers: [CertificateController],
})
export class CertificateModule {}
