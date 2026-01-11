export interface CreateCertificate {
  theoryScore: number;
  practiceScore: number;
  certificateNumber: string;
}

export interface UpdateCertificate {
  theoryScore?: number;
  practiceScore?: number;
  certificateNumber?: string;
  expDate?: Date;
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
  cotId: string;
  capabilityName: string;
  expDate: Date;
}