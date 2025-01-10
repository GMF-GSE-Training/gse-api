import { ParticipantResponse } from './participant.model';

export interface RegisterUserRequest {
  participantId?: string;
  idNumber?: string;
  nik: string;
  email: string;
  name: string;
  password: string;
  dinas?: string;
  roleId: string;
}

export interface LoginUserRequest {
  identifier: string;
  password: string;
}

export interface CurrentUserRequest {
  id: string;
  participantId?: string;
  idNumber: string;
  email: string;
  name: string;
  nik: string;
  dinas: string;
  roleId: string;
  refreshToken?: string;
  role: {
    id: string;
    name: string;
  };
}

export interface UpdatePassword {
  token?: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface AuthResponse {
  id?: string;
  idNumber?: string;
  email?: string;
  name?: string;
  dinas?: string;
  refreshToken?: string;
  accessToken?: string;
  role?: {
    id?: string;
    name?: string;
  };
  participant?: ParticipantResponse;
  isDataComplete?: boolean;
  expiredAt?: number;
}
