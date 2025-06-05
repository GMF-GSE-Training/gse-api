import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { CotStatus } from '../../model/cot.model.js';

/**
 * DTO untuk membuat COT baru.
 */
export class CreateCotDto {
  @IsNotEmpty()
  @IsUUID()
  capabilityId: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  trainingLocation: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  theoryInstructorRegGse: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  theoryInstructorCompetency: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  practicalInstructor1: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  practicalInstructor2: string;

  @IsNotEmpty()
  @IsEnum(CotStatus)
  status: CotStatus;
}

/**
 * DTO untuk memperbarui COT.
 */
export class UpdateCotDto {
  @IsOptional()
  @IsUUID()
  capabilityId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  trainingLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  theoryInstructorRegGse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  theoryInstructorCompetency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  practicalInstructor1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  practicalInstructor2?: string;

  @IsOptional()
  @IsEnum(CotStatus)
  status?: CotStatus;
}
