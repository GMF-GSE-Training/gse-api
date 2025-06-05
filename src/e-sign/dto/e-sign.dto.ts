import { SignatureType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO for creating an e-sign.
 */
export class CreateESignDto {
  @IsString()
  @IsNotEmpty({ message: 'No pegawai wajib diisi' })
  @MaxLength(50)
  idNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'Role wajib diisi' })
  @MaxLength(100)
  role!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(255)
  name!: string;

  @IsNotEmpty()
  @IsEnum(SignatureType, { message: 'Tipe tanda tangan tidak valid' })
  signatureType!: SignatureType;

  @IsNotEmpty()
  @IsBoolean({ message: 'Status wajib diisi' })
  status!: boolean;

  @IsNotEmpty()
  eSign!: Express.Multer.File; // Validated in controller
}

/**
 * DTO for updating an e-sign.
 */
export class UpdateESignDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  idNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  role?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsEnum(SignatureType)
  @IsOptional()
  signatureType?: SignatureType;

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsOptional()
  eSign?: Express.Multer.File; // Validated in controller
}