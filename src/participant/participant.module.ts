import { Module } from '@nestjs/common';
import { PrismaService } from '../common/service/prisma.service';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';

@Module({
  providers: [PrismaService, ParticipantService],
  controllers: [ParticipantController],
  exports: [ParticipantService],
})
export class ParticipantModule {}
