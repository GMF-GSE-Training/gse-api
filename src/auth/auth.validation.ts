import sanitizeHtml from 'sanitize-html';
import type { ZodType } from 'zod';
import { z } from 'zod';

/**
 * Nilai enum untuk OAuthProvider yang sesuai dengan schema.prisma.
 */
const OAuthProviderValues = ['GOOGLE', 'MICROSOFT'] as const;

/**
 * Skema Zod untuk validasi respons peserta.
 * @description Memvalidasi data peserta seperti NIK, email, dan dokumen terkait.
 */
export const ParticipantResponseSchema = z.object({
  id: z.string().uuid(),
  idNumber: z.string().nullable().optional(),
  name: z.string().min(1),
  nik: z.string().min(1).max(50),
  dinas: z.string().nullable().optional(),
  bidang: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  email: z.string().email(),
  phoneNumber: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  placeOfBirth: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  tglKeluarSuratSehatButaWarna: z.string().nullable().optional(),
  tglKeluarSuratBebasNarkoba: z.string().nullable().optional(),
  gmfNonGmf: z.string().nullable().optional(),
  qrCodeLink: z.string().nullable().optional(),
  simA: z.object({ path: z.string() }).nullable().optional(),
  simB: z.object({ path: z.string() }).nullable().optional(),
  ktp: z.object({ path: z.string() }).nullable().optional(),
  foto: z.object({ path: z.string() }).nullable().optional(),
  suratSehatButaWarna: z.object({ path: z.string() }).nullable().optional(),
  suratBebasNarkoba: z.object({ path: z.string() }).nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * Skema Zod untuk validasi respons autentikasi.
 * @description Memvalidasi data autentikasi seperti ID, email, dan token.
 */
export const AuthResponseSchema = z.object({
  id: z.string().uuid().optional(),
  idNumber: z.string().nullable().optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  dinas: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  accessToken: z.string().optional(),
  role: z
    .object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).optional(),
    })
    .nullable()
    .optional(),
  participant: ParticipantResponseSchema.nullable().optional(),
  isDataComplete: z.boolean().optional(),
  expiredAt: z.number().optional(),
  photo: z.string().nullable().optional(),
});

/**
 * Skema Zod untuk validasi permintaan OAuth login.
 * @description Memvalidasi data login OAuth seperti oauthId, email, dan provider.
 */
export const OAuthLoginRequestSchema = z.object({
  oauthId: z.any().transform(val => String(val)), // Coerce ke string
  email: z.string().email('Email tidak valid'),
  name: z.string().min(1, 'Nama diperlukan'),
  provider: z.enum(OAuthProviderValues, {
    errorMap: () => ({ message: 'Provider OAuth tidak valid' }),
  }),
  photo: z.string().nullable().optional(),
  state: z.string().optional(), // Ditambahkan untuk mendukung state OAuth
});

/**
 * Kelas untuk menyimpan skema validasi autentikasi.
 * @description Menyediakan skema Zod untuk REGISTER, LOGIN, UPDATE, EMAIL, UPDATEPASSWORD, dan TWOFA.
 */
export class AuthValidation {
  /**
   * Skema untuk validasi pendaftaran pengguna.
   */
  static readonly REGISTER: ZodType = z.object({
    participantId: z.string().uuid().nullable().optional(),
    idNumber: z.string().max(20).optional(),
    nik: z.string().min(1).max(50).optional(),
    email: z
      .string()
      .min(1)
      .max(255)
      .email()
      .transform(val => sanitizeHtml(val)),
    name: z
      .string()
      .min(1)
      .max(255)
      .transform(val => sanitizeHtml(val)),
    password: z
      .string()
      .min(8)
      .max(255)
      .refine(val => /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar, satu huruf kecil, dan satu angka',
      }),
    dinas: z
      .string()
      .max(20)
      .optional()
      .transform(val => (val ? sanitizeHtml(val) : val)),
    roleId: z.string().uuid().min(1).max(255).optional(),
    captchaToken: z.string().min(1, 'Token CAPTCHA diperlukan'),
  });

  /**
   * Skema untuk validasi login pengguna.
   */
  static readonly LOGIN: ZodType = z.object({
    identifier: z.string().min(1).max(255),
    password: z.string().min(1).max(255),
    captchaToken: z.string().min(1, 'Token CAPTCHA diperlukan'),
    twoFactorToken: z.string().min(6).max(6).optional(),
  });

  /**
   * Skema untuk validasi pembaruan data pengguna.
   */
  static readonly UPDATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20).optional(),
    nik: z.string().min(1).max(50).optional(),
    email: z
      .string()
      .min(1)
      .max(255)
      .email()
      .optional()
      .transform(val => (val ? sanitizeHtml(val) : val)),
    name: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .transform(val => (val ? sanitizeHtml(val) : val)),
    password: z
      .string()
      .min(8)
      .max(255)
      .refine(val => /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(val), {
        message:
          'Password harus memiliki minimal satu huruf besar, satu huruf kecil, dan satu angka',
      }),
    dinas: z
      .string()
      .min(1)
      .max(20)
      .optional()
      .transform(val => (val ? sanitizeHtml(val) : val)),
    roleId: z.string().uuid().min(1).optional(),
  });

  /**
   * Skema untuk validasi alamat email.
   */
  static readonly EMAIL: ZodType = z
    .string()
    .min(1)
    .max(255)
    .email()
    .transform(val => sanitizeHtml(val));

  /**
   * Skema untuk validasi pembaruan kata sandi.
   */
  static readonly UPDATEPASSWORD: ZodType = z
    .object({
      token: z.string().min(1).max(255).optional(),
      oldPassword: z
        .string()
        .min(8)
        .max(255)
        .refine(val => /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(val), {
          message:
            'Password harus memiliki minimal satu huruf besar, satu huruf kecil, dan satu angka',
        })
        .optional(),
      newPassword: z
        .string()
        .min(8)
        .max(255)
        .refine(val => /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(val), {
          message:
            'Password harus memiliki minimal satu huruf besar, satu huruf kecil, dan satu angka',
        }),
      confirmNewPassword: z
        .string()
        .min(8)
        .max(255)
        .refine(val => /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(val), {
          message:
            'Password harus memiliki minimal satu huruf besar, satu huruf kecil, dan satu angka',
        }),
    })
    .refine(data => data.newPassword === data.confirmNewPassword, {
      message: 'Konfirmasi password tidak cocok',
      path: ['confirmNewPassword'],
    })
    .refine(data => data.oldPassword || data.token, {
      message: 'Either oldPassword or token is required',
      path: ['oldPassword', 'token'],
    });

  /**
   * Skema untuk validasi token 2FA.
   */
  static readonly TWOFA: ZodType = z.object({
    token: z.string().min(6).max(6, 'Token 2FA harus 6 digit'),
  });
}
