export interface CreateCertificate {
  theoryScore: number;
  practiceScore: number;
  certificateNumber: string;
}

export interface CertificateResponse {
  id: string;
  trainingName: string;
  expiryDate: Date;
  certificateNumber?: string;
  status: string;
}

export interface CertificateListResponse {
  id: string;
  capabilityName: string;
  expDate: Date;
}