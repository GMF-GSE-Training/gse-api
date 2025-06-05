/**
 * Request untuk membuat participant.
 * @remarks Semua field opsional kecuali `name`, `nik`, dan `email` untuk memastikan data inti tersedia.
 */
export interface CreateParticipantRequest {
  idNumber?: string | null;
  name: string;
  nik: string;
  dinas?: string | null;
  bidang?: string | null;
  company?: string | null;
  email: string;
  phoneNumber?: string | null;
  nationality?: string | null;
  placeOfBirth?: string | null;
  dateOfBirth?: Date | null;
  tglKeluarSuratSehatButaWarna?: Date | null;
  tglKeluarSuratBebasNarkoba?: Date | null;
  gmfNonGmf?: string | null;
  simA?: Express.Multer.File | null;
  simB?: Express.Multer.File | null;
  ktp?: Express.Multer.File | null;
  foto?: Express.Multer.File | null;
  suratSehatButaWarna?: Express.Multer.File | null;
  suratBebasNarkoba?: Express.Multer.File | null;
}

/**
 * Request untuk memperbarui participant.
 * @remarks Semua field opsional untuk mendukung pembaruan parsial.
 */
export interface UpdateParticipantRequest {
  idNumber?: string | null;
  name?: string;
  nik?: string | null;
  dinas?: string | null;
  bidang?: string | null;
  company?: string | null;
  email?: string;
  phoneNumber?: string | null;
  nationality?: string | null;
  placeOfBirth?: string | null;
  dateOfBirth?: Date | null;
  tglKeluarSuratSehatButaWarna?: Date | null;
  tglKeluarSuratBebasNarkoba?: Date | null;
  gmfNonGmf?: string | null;
  simA?: Express.Multer.File | null;
  simB?: Express.Multer.File | null;
  ktp?: Express.Multer.File | null;
  foto?: Express.Multer.File | null;
  suratSehatButaWarna?: Express.Multer.File | null;
  suratBebasNarkoba?: Express.Multer.File | null;
}

/**
 * Response untuk daftar participant.
 * @remarks Hanya menyertakan field inti untuk efisiensi.
 */
export interface ListParticipantResponse {
  id: string;
  idNumber?: string | null;
  name: string;
  dinas?: string | null;
  bidang?: string | null;
  company?: string | null;
}

/**
 * Interface untuk respons peserta.
 * @description Menyimpan data peserta yang dikembalikan dari API.
 */
export interface ParticipantResponse {
  id: string;
  idNumber?: string | null;
  name: string;
  nik: string;
  email: string;
  dinas?: string | null;
  bidang?: string | null;
  company?: string | null;
  phoneNumber?: string | null;
  nationality?: string | null;
  placeOfBirth?: string | null;
  dateOfBirth?: string | null;
  simA?: { path: string } | null;
  simB?: { path: string } | null;
  ktp?: { path: string } | null;
  foto?: { path: string } | null;
  suratSehatButaWarna?: { path: string } | null;
  suratBebasNarkoba?: { path: string } | null;
  tglKeluarSuratSehatButaWarna?: string | null;
  tglKeluarSuratBebasNarkoba?: string | null;
  gmfNonGmf?: string | null;
  qrCodeLink?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
