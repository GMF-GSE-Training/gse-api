import { Module } from '@nestjs/common';
import { ParticipantCertificateService } from './participant-certificate.service';
import { ParticipantCertificateController } from './participant-certificate.controller';

@Module({
  providers: [ParticipantCertificateService],
  controllers: [ParticipantCertificateController],
})
export class ParticipantCertificateModule {}
