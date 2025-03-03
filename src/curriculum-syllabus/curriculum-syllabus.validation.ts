import { z, ZodType } from 'zod';

export class CurriculumSyllabusValidation {
  static readonly CREATE: ZodType = z.object({
    curriculumSyllabus: z.array(
      z.object({
        capabilityId: z.string().uuid().min(1),
        name: z.string().min(1).max(50),
        theoryDuration: z.number().min(0),
        practiceDuration: z.number().min(0),
        type: z.string().min(1),
      }),
    ),
  });

  static readonly UPDATE: ZodType = z.object({
    curriculumSyllabus: z.array(
      z.object({
        capabilityId: z.string().uuid().min(1).optional(),
        name: z.string().min(1).max(50).optional(),
        theoryDuration: z.number().min(0).optional(),
        practiceDuration: z.number().min(0).optional(),
        type: z.string().min(1),
      }),
    ),
  });
}
