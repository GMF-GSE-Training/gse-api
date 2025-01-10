export interface CreateCurriculumSyllabus {
  curriculumSyllabus: {
    capabilityId: string;
    name: string;
    theoryDuration?: number;
    practiceDuration?: number;
    type: string;
  }[];
}

export interface UpdateCurriculumSyllabus {
  curriculumSyllabus?: {
    id: string;
    capabilityId?: string;
    name?: string;
    theoryDuration?: number;
    practiceDuration?: number;
    type?: string;
  }[];
}
