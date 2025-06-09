/**
 * Status options for COT.
 */
export enum CotStatus {
  SCHEDULED = 'Dijadwalkan',
  IN_PROGRESS = 'Sedang Berjalan',
  COMPLETED = 'Selesai',
  CANCELLED = 'Dibatalkan',
}

/**
 * Request to create a new COT.
 */
export interface CreateCot {
  capabilityId: string;
  startDate: Date;
  endDate: Date;
  trainingLocation: string;
  theoryInstructorRegGse: string;
  theoryInstructorCompetency: string;
  practicalInstructor1: string;
  practicalInstructor2: string;
  status: CotStatus;
}

/**
 * Request to update an existing COT.
 */
export interface UpdateCot {
  capabilityId?: string;
  startDate?: Date;
  endDate?: Date;
  trainingLocation?: string;
  theoryInstructorRegGse?: string;
  theoryInstructorCompetency?: string;
  practicalInstructor1?: string;
  practicalInstructor2?: string;
  status?: CotStatus;
}

/**
 * Response structure for COT data.
 * @remarks `numberOfParticipants` dihitung secara dinamis berdasarkan relasi.
 */
export interface CotResponse {
  id: string;
  startDate: Date;
  endDate: Date;
  trainingLocation?: string | null;
  theoryInstructorRegGse?: string | null;
  theoryInstructorCompetency?: string | null;
  practicalInstructor1?: string | null;
  practicalInstructor2?: string | null;
  numberOfParticipants?: number;
  status?: CotStatus;
  capability?: {
    id: string;
    ratingCode: string;
    trainingName: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
