import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO untuk membuat participant baru.
 */
export class CreateParticipantDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  idNumber?: string | null;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  nik: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dinas?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bidang?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string | null;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  placeOfBirth?: string | null;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsDateString()
  tglKeluarSuratSehatButaWarna?: string | null;

  @IsOptional()
  @IsDateString()
  tglKeluarSuratBebasNarkoba?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gmfNonGmf?: string | null;

  @IsOptional()
  simA?: Express.Multer.File;

  @IsOptional()
  simB?: Express.Multer.File;

  @IsOptional()
  ktp?: Express.Multer.File;

  @IsOptional()
  foto?: Express.Multer.File;

  @IsOptional()
  suratSehatButaWarna?: Express.Multer.File;

  @IsOptional()
  suratBebasNarkoba?: Express.Multer.File;
}

/**
 * DTO untuk memperbarui participant.
 */
export class UpdateParticipantDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  idNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nik?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dinas?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  bidang?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  placeOfBirth?: string | null;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsDateString()
  tglKeluarSuratSehatButaWarna?: string | null;

  @IsOptional()
  @IsDateString()
  tglKeluarSuratBebasNarkoba?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gmfNonGmf?: string | null;

  @IsOptional()
  simA?: Express.Multer.File;

  @IsOptional()
  simB?: Express.Multer.File;

  @IsOptional()
  ktp?: Express.Multer.File;

  @IsOptional()
  foto?: Express.Multer.File;

  @IsOptional()
  suratSehatButaWarna?: Express.Multer.File;

  @IsOptional()
  suratBebasNarkoba?: Express.Multer.File;
}
