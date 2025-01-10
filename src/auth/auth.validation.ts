import { z, ZodType } from 'zod';

const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

export class AuthValidation {
  static readonly REGISTER: ZodType = z.object({
    idNumber: z.string().max(20).optional(),
    nik: z.string().min(1).max(50),
    email: z.string().min(1).max(255).email(),
    name: z.string().min(1).max(255),
    password: z
      .string()
      .min(8)
      .max(255)
      .refine((val) => passwordRegex.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar dan satu angka',
      }),
    dinas: z.string().max(20).optional(),
    roleId: z.string().uuid().min(1).max(255),
  });

  static readonly LOGIN: ZodType = z.object({
    identifier: z.string().min(1).max(255),
    password: z.string().min(1).max(255),
  });

  static readonly UPDATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20).optional(),
    nik: z.string().min(1).max(50).optional().optional(),
    email: z.string().min(1).max(255).email().optional(),
    name: z.string().min(1).max(255).optional(),
    password: z
      .string()
      .min(8)
      .max(255)
      .refine((val) => passwordRegex.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar dan satu angka',
      }),
    dinas: z.string().min(1).max(20).optional(),
    roleId: z.string().uuid().min(1).optional(),
  });

  static readonly EMAIL: ZodType = z.string().min(1).max(255).email();

  static readonly UPDATEPASSWORD: ZodType = z.object({
    token: z.string().min(1).max(255).optional(),
    newPassword: z
      .string()
      .min(8)
      .max(255)
      .refine((val) => passwordRegex.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar dan satu angka',
      }),
    confirmNewPassword: z
      .string()
      .min(8)
      .max(255)
      .refine((val) => passwordRegex.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar dan satu angka',
      }),
  });
}
