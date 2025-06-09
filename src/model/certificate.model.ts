/**
 * Request untuk membuat sertifikat.
 */
export interface CreateCertificate {
  participantId: string;
  cotId: string;
  theoryScore: number;
  practiceScore: number;
}

/**
 * Response untuk data sertifikat.
 */
export interface CertificateResponse {
  id: string;
  participantId: string;
  cotId: string;
  theoryScore: number;
  practiceScore: number;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
