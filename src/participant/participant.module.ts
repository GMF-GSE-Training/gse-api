import { Module } from '@nestjs/common';
import { PrismaService } from '../common/service/prisma.service';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';
import { CommonModule } from 'src/common/common.module';
import { QrCodeModule } from 'src/qrcode/qrcode.module';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [CommonModule, QrCodeModule, FileUploadModule],
  providers: [PrismaService, ParticipantService],
  controllers: [ParticipantController],
  exports: [ParticipantService],
})
export class ParticipantModule {}
