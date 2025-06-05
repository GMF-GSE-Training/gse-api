import type { ActionAccessRights, Paging } from './web.model.js';

/**
 * Response untuk data COT dengan participant.
 */
export interface ParticipantCotResponse {
  cot: {
    id: string;
    startDate: Date;
    endDate: Date;
    trainingLocation: string;
    theoryInstructorRegGse: string;
    theoryInstructorCompetency: string;
    practicalInstructor1: string;
    practicalInstructor2: string;
    numberOfParticipants: number;
    status: string;
    capability: {
      ratingCode: string;
      trainingName: string;
    };
    participants: {
      data: {
        name: string;
        id: string;
        idNumber?: string | null;
        dinas?: string | null;
        simAId?: number | null;
        simBId?: number | null;
        tglKeluarSuratSehatButaWarna?: Date | null;
        tglKeluarSuratBebasNarkoba?: Date | null;
      }[];
      paging: Paging;
      actions: ActionAccessRights;
    };
  };
}

/**
 * Request untuk menambahkan participant ke COT.
 */
export interface AddParticipantToCot {
  participantIds: string[];
}

/**
 * Response untuk penambahan participant.
 */
export interface AddParticipantResponse {
  message: string;
  updatedCount: number;
  addedParticipants: string[];
}
