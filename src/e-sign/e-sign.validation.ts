import { SignatureType } from 'src/model/e-sign.model';
import { z, ZodType } from 'zod';

export class ESignValidation {
  static readonly CREATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20),
    role: z.string().min(1).max(50),
    name: z.string().min(1).max(50),
    eSign: z.instanceof(Buffer).optional(),
    eSignFileName: z.string().optional(),
    signatureType: z.enum([SignatureType.SIGNATURE1, SignatureType.SIGNATURE2]),
    status: z.boolean(),
  });

  static readonly UPDATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20).optional(),
    role: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(50).optional(),
    eSign: z.instanceof(Buffer).optional(),
    eSignFileName: z.string().optional().optional(),
    signatureType: z
      .enum([SignatureType.SIGNATURE1, SignatureType.SIGNATURE2])
      .optional(),
    status: z.boolean().optional(),
  });
}
