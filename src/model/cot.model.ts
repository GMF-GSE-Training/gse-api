export interface CreateCot {
  capabilityId: string;
  startDate: Date;
  endDate: Date;
  trainingLocation: string;
  theoryInstructorRegGse: string;
  theoryInstructorCompetency: string;
  practicalInstructor1: string;
  practicalInstructor2: string;
  status: string;
}

export interface UpdateCot {
  capabilityId?: string;
  startDate?: Date;
  endDate?: Date;
  trainingLocation?: string;
  theoryInstructorRegGse?: string;
  theoryInstructorCompetency?: string;
  practicalInstructor1?: string;
  practicalInstructor2?: string;
  status?: string;
}

export interface CotResponse {
  id: string;
  startDate: Date;
  endDate: Date;
  trainingLocation?: string;
  theoryInstructorRegGse?: string;
  theoryInstructorCompetency?: string;
  practicalInstructor1?: string;
  practicalInstructor2?: string;
  numberOfParticipants?: number;
  status?: string;
  capability?: Object;
}
