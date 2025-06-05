/**
 * Request untuk membuat curriculum syllabus.
 * @remarks Berisi array syllabus dengan data wajib dan opsional.
 */
export interface CreateCurriculumSyllabus {
  curriculumSyllabus: {
    capabilityId: string;
    name: string;
    theoryDuration?: number | null;
    practiceDuration?: number | null;
    type: string;
  }[];
}

/**
 * Request untuk memperbarui curriculum syllabus.
 * @remarks Mendukung pembaruan parsial untuk array syllabus.
 */
export interface UpdateCurriculumSyllabus {
  curriculumSyllabus?: {
    id: string;
    capabilityId?: string;
    name?: string;
    theoryDuration?: number | null;
    practiceDuration?: number | null;
    type?: string;
  }[];
}
//hpus?^
/**
 * Response untuk data curriculum syllabus.
 * @remarks Mencakup semua field relevan dari model CurriculumSyllabus.
 */
export interface CurriculumSyllabusResponse {
  id: string;
  capabilityId: string;
  name: string;
  theoryDuration?: number | null;
  practiceDuration?: number | null;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}
