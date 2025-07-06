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
  simAPath?: string;
  simB?: Buffer;
  simBFileName?: string;
  simBPath?: string;
  ktp?: Buffer;
  ktpFileName?: string;
  ktpPath?: string;
  foto?: Buffer;
  fotoFileName?: string;
  fotoPath?: string;
  suratSehatButaWarna?: Buffer;
  suratSehatButaWarnaFileName?: string;
  suratSehatButaWarnaPath?: string;
  tglKeluarSuratSehatButaWarna?: Date;
  suratBebasNarkoba?: Buffer;
  suratBebasNarkobaFileName?: string;
  suratBebasNarkobaPath?: string;
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
  simAPath?: string;
  simB?: Buffer;
  simBFileName?: string;
  simBPath?: string;
  ktp?: Buffer;
  ktpFileName?: string;
  ktpPath?: string;
  foto?: Buffer;
  fotoFileName?: string;
  fotoPath?: string;
  suratSehatButaWarna?: Buffer;
  suratSehatButaWarnaFileName?: string;
  suratSehatButaWarnaPath?: string;
  tglKeluarSuratSehatButaWarna?: Date;
  suratBebasNarkoba?: Buffer;
  suratBebasNarkobaFileName?: string;
  suratBebasNarkobaPath?: string;
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
  simAPath?: string;
  simBFileName?: string;
  simBPath?: string;
  ktpFileName?: string;
  ktpPath?: string;
  fotoFileName?: string;
  fotoPath?: string;
  suratSehatButaWarnaFileName?: string;
  suratSehatButaWarnaPath?: string;
  tglKeluarSuratSehatButaWarna: Date;
  suratBebasNarkobaFileName?: string;
  suratBebasNarkobaPath?: string;
  tglKeluarSuratBebasNarkoba: Date;
  gmfNonGmf: string;
}
