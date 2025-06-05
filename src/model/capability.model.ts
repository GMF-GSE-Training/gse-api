/**
 * Request untuk membuat capability.
 */
export interface CreateCapability {
  ratingCode: string;
  trainingCode: string;
  trainingName: string;
}

/**
 * Request untuk memperbarui capability.
 */
export interface UpdateCapability {
  ratingCode?: string;
  trainingCode?: string;
  trainingName?: string;
}

/**
 * Response untuk data capability.
 */
export interface CapabilityResponse {
  id: string;
  ratingCode: string;
  trainingCode: string;
  trainingName: string;
  totalTheoryDurationRegGse?: number | null;
  totalPracticeDurationRegGse?: number | null;
  totalTheoryDurationCompetency?: number | null;
  totalPracticeDurationCompetency?: number | null;
  totalMaterialDurationRegGse?: number | null;
  totalMaterialDurationCompetency?: number | null;
  totalDuration?: number | null;
  curriculumSyllabus?: Array<{
    id: string;
    name: string;
    theoryDuration?: number | null;
    practiceDuration?: number | null;
    type: string;
  }> | null;
  createdAt: Date;
  updatedAt: Date;
}
