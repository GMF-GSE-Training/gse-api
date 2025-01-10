export interface CreateParticipantRequest {
  idNumber?: string;
  name: string;
  nik: string;
  dinas?: string;
  bidang?: string;
  company?: string;
  email: string;
  phoneNumber?: string;
  nationality?: string;
  placeOfBirth?: string;
  dateOfBirth?: Date;
  simA?: Buffer;
  simAFileName?: string;
  simB?: Buffer;
  simBFileName?: string;
  ktp?: Buffer;
  ktpFileName?: string;
  foto?: Buffer;
  fotoFileName?: string;
  suratSehatButaWarna?: Buffer;
  suratSehatButaWarnaFileName?: string;
  tglKeluarSuratSehatButaWarna?: Date;
  suratBebasNarkoba?: Buffer;
  suratBebasNarkobaFileName?: string;
  tglKeluarSuratBebasNarkoba?: Date;
  gmfNonGmf?: string;
}

export interface UpdateParticipantRequest {
  idNumber?: string;
  name?: string;
  nik?: string;
  dinas?: string;
  bidang?: string;
  company?: string;
  email?: string;
  phoneNumber?: string;
  nationality?: string;
  placeOfBirth?: string;
  dateOfBirth?: Date;
  simA?: Buffer;
  simAFileName?: string;
  simB?: Buffer;
  simBFileName?: string;
  ktp?: Buffer;
  ktpFileName?: string;
  foto?: Buffer;
  fotoFileName?: string;
  suratSehatButaWarna?: Buffer;
  suratSehatbutaWarnaFileName?: string;
  tglKeluarSuratSehatButaWarna?: Date;
  suratBebasNarkoba?: Buffer;
  suratBebasNarkobaFileName?: string;
  tglKeluarSuratBebasNarkoba?: Date;
  gmfNonGmf?: string;
}

export interface ListParticipantResponse {
  id: string;
  idNumber: string;
  name: string;
  dinas: string;
  bidang: string;
  company: string;
}

export interface ParticipantResponse {
  id: string;
  idNumber: string;
  name: string;
  nik: string;
  dinas: string;
  bidang: string;
  company: string;
  email: string;
  phoneNumber: string;
  nationality: string;
  placeOfBirth: string;
  dateOfBirth: Date;
  simAFileName?: string;
  simBFileName?: string;
  ktpFileName?: string;
  fotoFileName?: string;
  suratSehatButaWarnaFileName?: string;
  suratBebasNarkobaFileName?: string;
  tglKeluarSuratSehatButaWarna: Date;
  tglKeluarSuratBebasNarkoba: Date;
  gmfNonGmf: string;
}
