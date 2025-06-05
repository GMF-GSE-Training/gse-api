import { Module } from '@nestjs/common';

import { ParticipantCotController } from './participant-cot.controller.js';
import { ParticipantCotService } from './participant-cot.service.js';

/**
 *
 */
@Module({
  controllers: [ParticipantCotController],
  providers: [ParticipantCotService],
})
export class ParticipantCotModule {}
