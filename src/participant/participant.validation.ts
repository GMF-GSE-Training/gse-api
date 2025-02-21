import { z, ZodType } from 'zod';

export class ParticipantValidation {
  static readonly CREATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20).optional().nullable(),
    name: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z\s]+$/, { message: 'Nama hanay boleh berisi huruf' }),
    nik: z.string().min(1).min(1).max(50),
    dinas: z.string().min(1).max(50).optional().nullable(),
    bidang: z.string().min(1).max(50).optional().nullable(),
    company: z.string().min(1).max(255).optional(),
    email: z.string().email().min(1).max(50).optional(),
    phoneNumber: z.string().min(1).max(50).optional(),
    nationality: z.string().min(1).max(50).optional(),
    placeOfBirth: z.string().max(50).optional(),
    dateOfBirth: z.date().optional(),
    simA: z.instanceof(Buffer).optional(),
    simAFileName: z.string().optional().nullable(),
    simB: z.instanceof(Buffer).optional().nullable(),
    simBFileName: z.string().optional().nullable(),
    ktp: z.instanceof(Buffer).optional(),
    ktpFileName: z.string().optional().nullable(),
    foto: z.instanceof(Buffer).optional(),
    fotoFileName: z.string().optional().nullable(),
    suratSehatButaWarna: z.instanceof(Buffer).optional(),
    suratSehatButaWarnaFileName: z.string().optional().nullable(),
    tglKeluarSuratSehatButaWarna: z.date().optional(),
    suratBebasNarkoba: z.instanceof(Buffer).optional(),
    suratBebasNarkobaFileName: z.string().optional().nullable(),
    tglKeluarSuratBebasNarkoba: z.date().optional(),
    qrCode: z.instanceof(Buffer).optional(),
    gmfNonGmf: z.string().min(1).max(20).optional(),
  });

  static readonly UPDATE: ZodType = z.object({
    idNumber: z.string().max(20).optional().nullable(),
    name: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z\s]+$/, { message: 'Nama hanay boleh berisi huruf' })
      .optional(),
    nik: z.string().min(1).min(1).max(50).optional(),
    dinas: z.string().max(50).optional().nullable(),
    bidang: z.string().max(50).optional().nullable(),
    company: z.string().min(1).max(255).optional(),
    email: z.string().email().min(1).max(255).optional(),
    phoneNumber: z.string().min(1).max(50).optional(),
    nationality: z.string().min(1).max(50).optional(),
    placeOfBirth: z.string().max(50).optional(),
    dateOfBirth: z.date().optional(),
    simA: z.instanceof(Buffer).optional(),
    simAFileName: z.string().optional().nullable(),
    simB: z.instanceof(Buffer).optional().nullable(),
    simBFileName: z.string().optional().nullable(),
    ktp: z.instanceof(Buffer).optional(),
    ktpFileName: z.string().optional().nullable(),
    foto: z.instanceof(Buffer).optional(),
    fotoFileName: z.string().optional().nullable(),
    suratSehatButaWarna: z.instanceof(Buffer).optional(),
    suratSehatButaWarnaFileName: z.string().optional().nullable(),
    tglKeluarSuratSehatButaWarna: z.date().optional(),
    suratBebasNarkoba: z.instanceof(Buffer).optional(),
    suratBebasNarkobaFileName: z.string().optional().nullable(),
    tglKeluarSuratBebasNarkoba: z.date().optional(),
    qrCode: z.instanceof(Buffer).optional(),
    gmfNonGmf: z.string().min(1).max(20).optional(),
  });
}
