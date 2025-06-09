import { SignatureType } from '@prisma/client';
import type { ZodType } from 'zod';
import { z } from 'zod';

/**
 *
 */
export class ESignValidation {
  static readonly CREATE: ZodType = z.object({
    idNumber: z
      .string()
      .min(1, 'No pegawai wajib diisi')
      .max(20, 'No pegawai maksimum 20 karakter'),
    role: z
      .string()
      .min(1, 'Role wajib diisi')
      .max(50, 'Role maksimum 50 karakter'),
    name: z
      .string()
      .min(1, 'Nama wajib diisi')
      .max(50, 'Nama maksimum 50 karakter'),
    eSign: z.any(), // Validasi file dilakukan di controller
    signatureType: z.enum(
      [SignatureType.SIGNATURE1, SignatureType.SIGNATURE2],
      {
        message: 'Tipe tanda tangan tidak valid',
      }
    ),
    status: z.boolean({ required_error: 'Status wajib diisi' }),
  });

  static readonly UPDATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20).optional(),
    role: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(50).optional(),
    eSign: z.any().optional(), // Validasi file dilakukan di controller
    signatureType: z
      .enum([SignatureType.SIGNATURE1, SignatureType.SIGNATURE2])
      .optional(),
    status: z.boolean().optional(),
  });
}
//delete?
