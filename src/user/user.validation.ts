//dihapus
import type { ZodType } from 'zod';
import { z } from 'zod';

const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;

/**
 *
 */
export class UserValidation {
  static readonly CREATE: ZodType = z.object({
    participantId: z.string().uuid().max(255).optional().nullable(),
    idNumber: z.string().max(20).optional().nullable(),
    nik: z.string().max(50).optional().nullable(),
    email: z.string().min(1).max(255).email(),
    name: z.string().min(1).max(255),
    password: z
      .string()
      .min(8)
      .max(255)
      .refine(val => passwordRegex.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar dan satu angka',
      }),
    dinas: z.string().max(20).optional().nullable(),
    roleId: z.string().uuid().min(1),
  });

  static readonly UPDATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20).optional().nullable(),
    nik: z.string().min(1).max(50).optional().nullable(),
    email: z.string().email().min(1).max(255).optional(),
    name: z.string().min(1).max(255).optional(),
    password: z
      .string()
      .min(8)
      .max(255)
      .refine(val => passwordRegex.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar dan satu angka',
      })
      .optional(),
    dinas: z.string().min(1).max(20).optional().nullable(),
    roleId: z.string().uuid().min(1).optional(),
  });
}
