// import type { RoleResponse } from './role.model.js';
import type { RoleMinimal } from './auth.model.js';

/**
 * Request untuk membuat pengguna baru.
 */
export interface CreateUserRequest {
  participantId?: string | null;
  idNumber?: string | null;
  nik?: string | null;
  email: string;
  name: string;
  password: string;
  dinas?: string | null;
  roleId: string;
}

/**
 * Request untuk memperbarui pengguna.
 */
export interface UpdateUserRequest {
  idNumber?: string | null;
  nik?: string | null;
  email?: string;
  name?: string;
  password?: string;
  dinas?: string | null;
  roleId?: string;
}

/**
 * Response untuk daftar pengguna.
 */
export interface UserListResponse {
  data: {
    id: string;
    idNumber?: string | null;
    email: string;
    name: string;
    dinas?: string | null;
    roleId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  paging?: {
    totalPage: number;
    currentPage: number;
    size: number;
    totalItems?: number;
  };
}

/**
 * Response untuk pengguna.
 */
export interface UserResponse {
  id: string;
  email: string;
  name?: string;
  role?: RoleMinimal;
  createdAt?: Date;
  updatedAt?: Date;
}
