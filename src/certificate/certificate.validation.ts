import { z, ZodType } from 'zod';

export class CertificateValidation {
  static readonly CREATE: ZodType = z.object({
    theoryScore: z
      .number()
      .positive()
      .max(100, { message: 'Nilai tidak boleh lebih dari 100' }),
    practiceScore: z
      .number()
      .positive()
      .max(100, { message: 'Nilai tidak boleh lebih dari 100' }),
    certificateNumber: z.string().min(1).max(50),
  });
}
