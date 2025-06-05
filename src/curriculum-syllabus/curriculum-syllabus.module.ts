import { Module } from '@nestjs/common';

import { CurriculumSyllabusController } from './curriculum-syllabus.controller.js';
import { CurriculumSyllabusService } from './curriculum-syllabus.service.js';

/**
 *
 */
@Module({
  providers: [CurriculumSyllabusService],
  controllers: [CurriculumSyllabusController],
})
export class CurriculumSyllabusModule {}
