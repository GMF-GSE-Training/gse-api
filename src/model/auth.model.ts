import type { ParticipantResponse } from './participant.model.js';

/**
 * Interface untuk payload JWT.
 * @description Menyimpan data yang ada di dalam token JWT.
 */
export interface JwtPayload {
  id: string;
  email?: string;
  sessionId?: string;
  role?: { id: string; name: string };
  iat?: number;
  exp?: number;
}

/**
 * Interface untuk respons autentikasi.
 * @description Menyimpan data pengguna yang dikembalikan setelah autentikasi.
 */
export interface AuthResponse {
  id: string;
  idNumber?: string | null;
  email: string;
  name: string;
  dinas?: string | null;
  refreshToken?: string | null;
  accessToken?: string;
  role?: { id: string; name: string } | null;
  participant?: ParticipantResponse | null;
  isDataComplete?: boolean;
  expiredAt?: number;
  photo?: string | null;
}

/**
 * Interface untuk permintaan registrasi pengguna.
 * @description Data yang diperlukan untuk mendaftarkan pengguna baru.
 */
export interface RegisterUserRequest {
  participantId?: string | null;
  idNumber?: string | null;
  nik?: string | null;
  email: string;
  name: string;
  password: string;
  dinas?: string | null;
  roleId?: string;
  captchaToken: string;
}

/**
 * Interface untuk permintaan login pengguna.
 * @description Data yang diperlukan untuk login pengguna.
 */
export interface LoginUserRequest {
  identifier: string;
  password: string;
  captchaToken: string;
  twoFactorToken?: string;
}

/**
 * Interface untuk permintaan login OAuth.
 * @description Data yang diperlukan untuk login menggunakan OAuth.
 */
export interface OAuthLoginRequest {
  oauthId: string;
  email: string | null;
  name: string;
  provider: string;
  photo?: string | null;
  state?: string;
}

/**
 * Interface untuk pengguna saat ini.
 * @description Data pengguna yang sedang terautentikasi.
 */
export interface CurrentUserRequest {
  id: string;
  participantId?: string | null;
  idNumber?: string | null;
  email: string;
  name: string;
  nik?: string | null;
  dinas?: string | null;
  role: { id: string; name: string };
  photo?: string | null;
}

/**
 * Interface untuk pembaruan kata sandi.
 * @description Data yang diperlukan untuk mengubah kata sandi.
 */
export interface UpdatePassword {
  token?: string;
  oldPassword?: string;
  newPassword: string;
  confirmNewPassword: string;
}

/**
 * Interface untuk pengiriman email.
 * @description Data yang diperlukan untuk mengirim email.
 */
export interface SendEmail {
  from: { name: string; address: string };
  recipients: { name: string; address: string }[];
  subject: string;
  html: string;
  placeholderReplacements?: Record<string, string>;
}

/**
 * Enum untuk penyedia OAuth yang didukung.
 */
export enum OAuthProvider {
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
}
