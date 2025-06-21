import { Module } from '@nestjs/common';
import { PrismaService } from '../common/service/prisma.service';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';
import { CommonModule } from 'src/common/common.module';
import { QrCodeModule } from 'src/qrcode/qrcode.module';

@Module({
  imports: [CommonModule, QrCodeModule],
  providers: [PrismaService, ParticipantService],
  controllers: [ParticipantController],
  exports: [ParticipantService],
})
export class ParticipantModule {}
