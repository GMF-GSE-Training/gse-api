import type { ZodType } from 'zod';
import { z } from 'zod';

/**
 *
 */
export class ParticipantValidation {
  static readonly CREATE: ZodType = z.object({
    idNumber: z.string().min(1).max(20).optional().nullable(),
    name: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z\s]+$/, { message: 'Nama hanya boleh berisi huruf' }),
    nik: z.string().min(1).max(50),
    dinas: z.string().min(1).max(50).optional().nullable(),
    bidang: z.string().min(1).max(50).optional().nullable(),
    company: z.string().min(1).max(255).optional(),
    email: z.string().email().min(1).max(255).optional(),
    phoneNumber: z.string().min(1).max(50).optional(),
    nationality: z.string().min(1).max(50).optional(),
    placeOfBirth: z.string().max(50).optional(),
    dateOfBirth: z.date().optional(),
    simA: z.any().optional(), // Express.Multer.File
    simB: z.any().optional(), // Express.Multer.File
    ktp: z.any().optional(), // Express.Multer.File
    foto: z.any().optional(), // Express.Multer.File
    suratSehatButaWarna: z.any().optional(), // Express.Multer.File
    suratBebasNarkoba: z.any().optional(), // Express.Multer.File
    tglKeluarSuratSehatButaWarna: z.date().optional(),
    tglKeluarSuratBebasNarkoba: z.date().optional(),
    gmfNonGmf: z.string().min(1).max(20).optional(),
  });

  static readonly UPDATE: ZodType = z.object({
    idNumber: z.string().max(20).optional().nullable(),
    name: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z\s]+$/, { message: 'Nama hanya boleh berisi huruf' })
      .optional(),
    nik: z.string().min(1).max(50).optional(),
    dinas: z.string().max(50).optional().nullable(),
    bidang: z.string().max(50).optional().nullable(),
    company: z.string().min(1).max(255).optional(),
    email: z.string().email().min(1).max(255).optional(),
    phoneNumber: z.string().min(1).max(50).optional(),
    nationality: z.string().min(1).max(50).optional(),
    placeOfBirth: z.string().max(50).optional(),
    dateOfBirth: z.date().optional(),
    simA: z.any().optional(), // Express.Multer.File
    simB: z.any().optional(), // Express.Multer.File
    ktp: z.any().optional(), // Express.Multer.File
    foto: z.any().optional(), // Express.Multer.File
    suratSehatButaWarna: z.any().optional(), // Express.Multer.File
    suratBebasNarkoba: z.any().optional(), // Express.Multer.File
    tglKeluarSuratSehatButaWarna: z.date().optional(),
    tglKeluarSuratBebasNarkoba: z.date().optional(),
    gmfNonGmf: z.string().min(1).max(20).optional(),
  });
}
