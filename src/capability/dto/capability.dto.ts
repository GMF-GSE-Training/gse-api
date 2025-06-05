import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO untuk membuat capability.
 */
export class CreateCapabilityDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  ratingCode: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  trainingCode: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  trainingName: string;
}

/**
 * DTO untuk memperbarui capability.
 */
export class UpdateCapabilityDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ratingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  trainingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  trainingName?: string;
}
