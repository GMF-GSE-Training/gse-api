import { Module } from '@nestjs/common';

import { PrismaService } from '../common/service/prisma.service.js';

import { ParticipantController } from './participant.controller.js';
import { ParticipantService } from './participant.service.js';

/**
 *
 */
@Module({
  providers: [PrismaService, ParticipantService],
  controllers: [ParticipantController],
  exports: [ParticipantService],
})
export class ParticipantModule {}
