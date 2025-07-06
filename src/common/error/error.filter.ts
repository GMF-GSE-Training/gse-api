import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any;

    if (exception instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      const errors = this.formatZodErrors(exception.errors);
      errorResponse = {
        code: statusCode,
        status: HttpStatus[statusCode],
        errors: errors,
      };
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      // Penanganan khusus untuk 429 (rate limit)
      if (statusCode === 429) {
        // Ambil Retry-After dari exception response jika ada, jika tidak default 3600 detik
        let retryAfter = 3600;
        let retryAfterHeader = null;
        if (exception.getResponse && typeof exception.getResponse === 'function') {
          const resp = exception.getResponse();
          if (typeof resp === 'object' && resp && 'retryAfter' in resp) {
            retryAfter = Number(resp['retryAfter']) || 3600;
          }
          if (typeof resp === 'object' && resp && 'message' in resp && typeof resp['message'] === 'number') {
            retryAfter = Number(resp['message']) || 3600;
          }
        }
        // Cek jika ada header Retry-After di exception (misal dari Throttler)
        if (exception.getResponse && typeof exception.getResponse === 'function') {
          const resp = exception.getResponse();
          if (typeof resp === 'object' && resp && 'getResponseHeaders' in resp && typeof resp['getResponseHeaders'] === 'function') {
            const headers = resp['getResponseHeaders']();
            if (headers && headers['Retry-After']) {
              retryAfterHeader = Number(headers['Retry-After']);
              if (!isNaN(retryAfterHeader)) retryAfter = retryAfterHeader;
            }
          }
        }
        // Format waktu
        const minutes = Math.floor(retryAfter / 60);
        const seconds = retryAfter % 60;
        const waitMsg = minutes > 0
          ? `Silakan coba lagi dalam ${minutes} menit${seconds > 0 ? ' ' + seconds + ' detik' : ''}.`
          : `Silakan coba lagi dalam ${seconds} detik.`;
        errorResponse = {
          code: statusCode,
          status: HttpStatus[statusCode],
          errors: exception.message || 'Terlalu banyak permintaan.',
          retryAfter: retryAfter,
          message: waitMsg,
        };
        response.setHeader('Retry-After', retryAfter);
        response.status(statusCode).json(errorResponse);
        return;
      }
      errorResponse = {
        code: statusCode,
        status: HttpStatus[statusCode],
        errors: exception.message,
      };
    } else if (exception instanceof MulterError) {
      statusCode = HttpStatus.BAD_REQUEST;
      errorResponse = {
        code: statusCode,
        status: HttpStatus[statusCode],
        errors: {
          [exception.field]: [exception.message],
        },
      };
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // Penanganan khusus error P2024 (connection pool timeout)
      if (exception.code === 'P2024') {
        statusCode = HttpStatus.SERVICE_UNAVAILABLE;
        errorResponse = {
          code: statusCode,
          status: HttpStatus[statusCode],
          errors: 'Server sedang sibuk, silakan coba beberapa saat lagi dalam beberapa menit.',
        };
      } else if (exception.code === 'P2002') {
        // Error Unique Constraint Violation
        const target = exception.meta?.target as string | undefined;
        errorResponse = {
          code: HttpStatus.CONFLICT,
          status: HttpStatus[HttpStatus.CONFLICT],
          errors: {
            [target || 'field']: [
              `Data untuk field '${target || 'field'}' sudah ada dan tidak boleh duplikat.`,
            ],
          },
        };
      } else if (exception.code === 'P2003') {
        // Error Foreign Key Constraint Violation
        const field = exception.meta?.field_name as string | undefined;
        errorResponse = {
          code: HttpStatus.BAD_REQUEST,
          status: HttpStatus[HttpStatus.BAD_REQUEST],
          errors: {
            [field || 'foreign key']: [
              `Field '${field || 'foreign key'}' tidak valid karena melanggar batasan relasi.`,
            ],
            [field]: [
              `Field '${field}' tidak valid karena melanggar batasan relasi.`,
            ],
          },
        };
      } else {
        // Error Prisma Lainnya
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        errorResponse = {
          code: statusCode,
          status: HttpStatus[statusCode],
          errors: 'Maaf, terjadi gangguan pada sistem. Silakan coba beberapa saat lagi.',
        };
      }
    } else if (exception instanceof PrismaClientValidationError) {
      // Error Validasi Prisma
      statusCode = HttpStatus.BAD_REQUEST;
      errorResponse = {
        code: statusCode,
        status: HttpStatus[statusCode],
        errors: {
          message: 'Kesalahan validasi data untuk model tertentu.',
          details: exception.message,
        },
      };
    } else if (exception instanceof PrismaClientRustPanicError) {
      // Kesalahan Internal Prisma
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        code: statusCode,
        status: HttpStatus[statusCode],
        errors: 'Maaf, terjadi gangguan internal pada sistem. Silakan coba beberapa saat lagi.',
      };
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      let fallbackMessage = 'Maaf, terjadi gangguan pada sistem. Silakan coba beberapa saat lagi.';
      // Jika pesan error terlalu teknis (mengandung "Exception" atau "Error"), fallback ke pesan ramah
      const msg = exception.message || '';
      if (msg.match(/Exception|Error|database|timeout|connection|prisma|stack|failed|not found|undefined|null|internal/i)) {
        errorResponse = {
          code: statusCode,
          status: HttpStatus[statusCode],
          errors: fallbackMessage,
        };
      } else {
      errorResponse = {
        code: statusCode,
        status: HttpStatus[statusCode],
          errors: msg || fallbackMessage,
      };
      }
    }

    response.status(statusCode).json(errorResponse);
  }

  private formatZodErrors(zodErrors: any[]): Record<string, string[]> {
    const formattedErrors: Record<string, string[]> = {};

    zodErrors.forEach((error) => {
      const fieldName = error.path.join('.');
      if (!formattedErrors[fieldName]) {
        formattedErrors[fieldName] = [];
      }
      formattedErrors[fieldName].push(error.message);
    });

    return formattedErrors;
  }
}
