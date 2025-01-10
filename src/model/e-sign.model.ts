export interface CreateESign {
  idNumber: string;
  role: string;
  name: string;
  eSign: Buffer;
  eSignFileName?: string;
  signatureType: SignatureType;
  status: boolean;
}

export interface UpdateESign {
  idNumber?: string;
  role?: string;
  name?: string;
  eSign?: Buffer;
  eSignFileName?: string;
  signatureType?: SignatureType;
  status?: boolean;
}

export interface ESignResponse {
  idNumber: string;
  role: string;
  name: string;
  eSign?: Buffer;
  eSignFileName?: string;
  signatureType: SignatureType;
  status: boolean;
}

export enum SignatureType {
  SIGNATURE1 = 'SIGNATURE1',
  SIGNATURE2 = 'SIGNATURE2',
}
