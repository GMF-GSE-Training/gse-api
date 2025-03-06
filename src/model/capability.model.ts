export interface CreateCapability {
  ratingCode: string;
  trainingCode: string;
  trainingName: string;
}

export interface UpdateCapability {
  ratingCode?: string;
  trainingCode?: string;
  trainingName?: string;
}

export interface CapabilityResponse {
  id: string;
  ratingCode: string;
  trainingCode: string;
  trainingName: string;
  totalTheoryDurationRegGse?: number;
  totalPracticeDurationRegGse?: number;
  totalTheoryDurationCompetency?: number;
  totalPracticeDurationCompetency?: number;
  totalMaterialDurationRegGse?: number;
  totalMaterialDurationCompetency?: number;
  totalDuration?: number;
  curriculumSyllabus?: Object[];
}
