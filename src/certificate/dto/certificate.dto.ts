import { IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO untuk membuat sertifikat.
 */
export class CreateCertificateDto {
  @IsNotEmpty()
  @IsNumber()
  theoryScore!: number;

  @IsNotEmpty()
  @IsNumber()
  practiceScore!: number;
}
