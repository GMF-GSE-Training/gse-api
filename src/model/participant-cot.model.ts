import { ActionAccessRights, Paging } from './web.model';

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
    totalParticipants: number;
    status: string;
    capability: {
      ratingCode: string;
      trainingName: string;
    };
    participants: {
      data: {
        name: string;
        id: string;
        idNumber: string;
        dinas: string;
        simA?: boolean;
        simB?: boolean;
        tglKeluarSuratSehatButaWarna?: Date;
        tglKeluarSuratBebasNarkoba?: Date;
      }[];
      paging: Paging;
      actions: ActionAccessRights;
    };
  };
}

export interface addParticipantToCot {
  participantIds: string[];
}

export interface AddParticipantResponse {
  message: string;
  updatedCount: number;
  addedParticipants: string[];
}
