import { Module } from '@nestjs/common';
import { CurriculumSyllabusService } from './curriculum-syllabus.service';
import { CurriculumSyllabusController } from './curriculum-syllabus.controller';

@Module({
  providers: [CurriculumSyllabusService],
  controllers: [CurriculumSyllabusController],
})
export class CurriculumSyllabusModule {}
