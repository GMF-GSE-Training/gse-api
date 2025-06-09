import type { StreamableFile } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';

/**
 * Generic API response structure.
 */
export interface WebResponse<T> {
  statusCode: number;
  status: string;
  message?: string;
  data?: T;
  errors?: string[];
  actions?: ActionAccessRights;
  paging?: Paging;
  fileStream?: StreamableFile;
}

/**
 * Action access rights for UI controls.
 */
export interface ActionAccessRights {
  canEdit?: boolean;
  canDelete?: boolean;
  canView?: boolean;
  canPrint?: boolean;
}

/**
 * Pagination information.
 */
export interface Paging {
  totalPage: number;
  currentPage: number;
  size: number;
  totalItems?: number;
}

/**
 * Request parameters for listing data.
 */
export interface ListRequest {
  searchQuery?: string;
  page?: number;
  size?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Builds a standardized API response.
 * @param statusCode - HTTP status code.
 * @param data - Response data (optional).
 * @param errors - List of error messages (optional).
 * @param actions - Action access rights (optional).
 * @param paging - Pagination info (optional).
 * @param fileStream - File stream (optional).
 * @param message - Custom message (optional).
 * @returns Standardized WebResponse object.
 */
export function buildResponse<T>(
  statusCode: number,
  data?: T,
  errors?: string[] | string,
  actions?: ActionAccessRights,
  paging?: Paging,
  fileStream?: StreamableFile,
  message?: string
): WebResponse<T> {
  const statusMessage = HttpStatus[statusCode] || 'UNKNOWN_STATUS';
  const normalizedErrors = typeof errors === 'string' ? [errors] : errors;

  return {
    statusCode,
    status: statusMessage,
    message,
    data,
    errors: normalizedErrors,
    actions,
    paging,
    fileStream,
  };
}
