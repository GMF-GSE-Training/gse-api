import { Module } from '@nestjs/common';
import { ParticipantCotService } from './participant-cot.service';
import { ParticipantCotController } from './participant-cot.controller';

@Module({
  controllers: [ParticipantCotController],
  providers: [ParticipantCotService],
})
export class ParticipantCotModule {}
