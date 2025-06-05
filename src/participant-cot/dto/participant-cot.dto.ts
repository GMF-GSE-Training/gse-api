import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

/**
 * DTO untuk menambahkan participant ke COT.
 */
export class AddParticipantToCotDto {
  @IsArray()
  @IsNotEmpty()
  @IsUUID(undefined, { each: true })
  participantIds: string[];
}
