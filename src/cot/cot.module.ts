import { Module } from '@nestjs/common';
import { CotService } from './cot.service';
import { CotController } from './cot.controller';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [CertificateModule],
  providers: [CotService],
  controllers: [CotController],
})
export class CotModule {}
