import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * DTO untuk individual curriculum syllabus entry.
 */
export class CurriculumSyllabusEntryDto {
  @IsUUID()
  @IsNotEmpty()
  capabilityId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsNumber()
  @IsOptional()
  theoryDuration?: number;

  @IsNumber()
  @IsOptional()
  practiceDuration?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;
}

/**
 * DTO untuk membuat curriculum syllabus.
 */
export class CreateCurriculumSyllabusDto {
  @IsArray()
  @IsNotEmpty()
  curriculumSyllabus: CurriculumSyllabusEntryDto[];
}

/**
 * DTO untuk individual curriculum syllabus update entry.
 */
export class UpdateCurriculumSyllabusEntryDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsOptional()
  @IsUUID()
  capabilityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsNumber()
  theoryDuration?: number;

  @IsOptional()
  @IsNumber()
  practiceDuration?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;
}

/**
 * DTO untuk memperbarui curriculum syllabus.
 */
export class UpdateCurriculumSyllabusDto {
  @IsArray()
  @IsOptional()
  curriculumSyllabus?: UpdateCurriculumSyllabusEntryDto[];
}
