import { HttpStatus, StreamableFile } from '@nestjs/common';

export interface WebResponse<T> {
  code: number;
  status: string;
  data?: T;
  errors?: string;
  actions?: ActionAccessRights;
  paging?: Paging;
  fileStream?: StreamableFile;
}

export interface ActionAccessRights {
  canEdit?: boolean;
  canDelete?: boolean;
  canView?: boolean;
  canPrint?: boolean;
}

export interface Paging {
  totalPage: number;
  currentPage: number;
  size: number;
}

export interface ListRequest {
  searchQuery?: string;
  page?: number;
  size?: number;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function buildResponse<T>(
  statusCode: number,
  data?: T,
  errors?: any,
  actions?: ActionAccessRights,
  paging?: Paging,
  fileStream?: StreamableFile,
  info?: string // Tambahkan parameter info opsional
): WebResponse<T> {
  const statusMessage = HttpStatus[statusCode] || 'UNKNOWN_STATUS';
  return {
    code: statusCode,
    status: statusMessage,
    ...(data && { data }),
    ...(errors && { errors }),
    ...(actions && { actions }),
    ...(paging && { paging }),
    ...(fileStream && { fileStream }),
    ...(info && { info }), // Tambahkan info jika ada
  };
}
