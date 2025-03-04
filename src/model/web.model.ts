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
}

export function buildResponse<T>(
  statusCode: number,
  data?: T,
  errors?: any,
  actions?: ActionAccessRights,
  paging?: Paging,
  fileStream?: StreamableFile,
): WebResponse<T> {
  const statusMessage = HttpStatus[statusCode] || 'UNKNOWN_STATUS';
  return {
    code: statusCode,
    status: statusMessage,
    ...(data && { data }), // Hanya tambahkan data jika ada
    ...(errors && { errors }), // Hanya tambahkan errors jika ada
    ...(actions && { actions }), // Tambahkan actions jika ada
    ...(paging && { paging }), // Tambahkan paging jika ada
    ...(fileStream && { fileStream }), // Tambahkan fileStream jika ada
  };
}
