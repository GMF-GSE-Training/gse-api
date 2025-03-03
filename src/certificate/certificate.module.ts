import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';

@Module({
  providers: [CertificateService],
  controllers: [CertificateController],
})
export class CertificateModule {}
