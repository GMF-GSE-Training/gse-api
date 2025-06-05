import { ApiProperty } from '@nestjs/swagger';

import { z } from 'zod';

/**
 * Skema Zod untuk membuat pengguna baru.
 * @remarks
 * - `nik` harus 16 digit angka jika diisi.
 * - `password` harus minimal 8 karakter, mengandung huruf besar dan angka.
 * - `idNumber` dan `dinas` opsional, sesuai dengan schema Prisma.
 * - Validasi bisnis (misalnya, `nik` wajib untuk role `user`) dilakukan di `UserService`.
 */
export const CreateUserSchema = z.object({
  participantId: z
    .string()
    .uuid({ message: 'Participant ID harus berupa UUID' })
    .nullable()
    .optional()
    .describe('ID peserta (opsional, UUID jika diisi)'),
  idNumber: z
    .string()
    .max(20, { message: 'No pegawai maksimum 20 karakter' })
    .nullable()
    .optional()
    .describe('Nomor pegawai (opsional, maks 20 karakter)'),
  nik: z
    .string()
    .regex(/^[0-9]{16}$/, { message: 'NIK harus berupa 16 digit angka' })
    .nullable()
    .optional()
    .describe('Nomor Induk Kependudukan (opsional, 16 digit angka jika diisi)'),
  email: z
    .string()
    .email({ message: 'Email tidak valid' })
    .max(255, { message: 'Email maksimum 255 karakter' })
    .transform(val => val.toLowerCase())
    .describe('Alamat email (wajib, akan diubah ke huruf kecil)'),
  name: z
    .string()
    .min(1, { message: 'Nama wajib diisi' })
    .max(255, { message: 'Nama maksimum 255 karakter' })
    .describe('Nama lengkap pengguna (wajib)'),
  password: z
    .string()
    .min(8, { message: 'Kata sandi minimal 8 karakter' })
    .max(255)
    .regex(/^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/, {
      message: 'Kata sandi harus mengandung huruf besar dan angka',
    })
    .describe(
      'Kata sandi (wajib, minimal 8 karakter dengan huruf besar dan angka)'
    ),
  dinas: z
    .string()
    .max(20, { message: 'Dinas maksimum 20 karakter' })
    .nullable()
    .optional()
    .describe('Kode dinas (opsional, maks 20 karakter)'),
  roleId: z
    .string()
    .uuid({ message: 'Role ID harus berupa UUID' })
    .describe('ID role pengguna (wajib, UUID)'),
});

/**
 * Skema Zod untuk memperbarui pengguna.
 * @remarks
 * - Semua field opsional untuk fleksibilitas pembaruan.
 * - `nik` harus 16 digit angka jika diisi.
 * - `password` harus minimal 8 karakter, mengandung huruf besar dan angka jika diisi.
 * - Validasi bisnis dilakukan di `UserService`.
 */
export const UpdateUserSchema = z.object({
  participantId: z
    .string()
    .uuid({ message: 'Participant ID harus berupa UUID' })
    .nullable()
    .optional()
    .describe('ID peserta (opsional, UUID jika diisi)'),
  idNumber: z
    .string()
    .max(20, { message: 'No pegawai maksimum 20 karakter' })
    .nullable()
    .optional()
    .describe('Nomor pegawai (opsional, maks 20 karakter)'),
  nik: z
    .string()
    .regex(/^[0-9]{16}$/, { message: 'NIK harus berupa 16 digit angka' })
    .nullable()
    .optional()
    .describe('Nomor Induk Kependudukan (opsional, 16 digit angka jika diisi)'),
  email: z
    .string()
    .email({ message: 'Email tidak valid' })
    .max(255, { message: 'Email maksimum 255 karakter' })
    .transform(val => val.toLowerCase())
    .optional()
    .describe('Alamat email (opsional, akan diubah ke huruf kecil jika diisi)'),
  name: z
    .string()
    .min(1, { message: 'Nama wajib diisi' })
    .max(255, { message: 'Nama maksimum 255 karakter' })
    .optional()
    .describe('Nama lengkap pengguna (opsional)'),
  password: z
    .string()
    .min(8, { message: 'Kata sandi minimal 8 karakter' })
    .max(255)
    .regex(/^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/, {
      message: 'Kata sandi harus mengandung huruf besar dan angka',
    })
    .optional()
    .describe(
      'Kata sandi (opsional, minimal 8 karakter dengan huruf besar dan angka jika diisi)'
    ),
  dinas: z
    .string()
    .max(20, { message: 'Dinas maksimum 20 karakter' })
    .nullable()
    .optional()
    .describe('Kode dinas (opsional, maks 20 karakter)'),
  roleId: z
    .string()
    .uuid({ message: 'Role ID harus berupa UUID' })
    .optional()
    .describe('ID role pengguna (opsional, UUID jika diisi)'),
});

// Tipe DTO yang dihasilkan dari skema Zod
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

// Kelas DTO untuk Swagger
/**
 *
 */
export class CreateUserDtoClass implements CreateUserDto {
  @ApiProperty({ required: false, nullable: true })
  participantId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  idNumber?: string | null;

  @ApiProperty({ required: false, nullable: true })
  nik?: string | null;

  @ApiProperty({ required: true })
  email: string;

  @ApiProperty({ required: true })
  name: string;

  @ApiProperty({ required: true })
  password: string;

  @ApiProperty({ required: false, nullable: true })
  dinas?: string | null;

  @ApiProperty({ required: true })
  roleId: string;

  constructor(
    email: string,
    name: string,
    password: string,
    roleId: string,
    participantId?: string | null,
    idNumber?: string | null,
    nik?: string | null,
    dinas?: string | null
  ) {
    this.email = email;
    this.name = name;
    this.password = password;
    this.roleId = roleId;
    this.participantId = participantId;
    this.idNumber = idNumber;
    this.nik = nik;
    this.dinas = dinas;
  }
}

/**
 *
 */
export class UpdateUserDtoClass implements UpdateUserDto {
  @ApiProperty({ required: false, nullable: true })
  participantId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  idNumber?: string | null;

  @ApiProperty({ required: false, nullable: true })
  nik?: string | null;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  password?: string;

  @ApiProperty({ required: false, nullable: true })
  dinas?: string | null;

  @ApiProperty({ required: false })
  roleId?: string;
}