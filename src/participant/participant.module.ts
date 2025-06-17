import { Module } from '@nestjs/common';
import { PrismaService } from '../common/service/prisma.service';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [PrismaService, ParticipantService],
  controllers: [ParticipantController],
  exports: [ParticipantService],
})
export class ParticipantModule {}
