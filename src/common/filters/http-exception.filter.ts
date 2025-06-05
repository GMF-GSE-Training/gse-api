import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

// Tipe untuk respons error
type HttpErrorResponse = string | { message?: string; [key: string]: unknown };

/**
 * Filter global untuk menangani semua pengecualian HTTP dan non-HTTP,
 * mengembalikan respons JSON yang konsisten dan mencatat error untuk debugging.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * @param configService - Service untuk mengakses konfigurasi aplikasi.
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Menangkap pengecualian, menentukan status HTTP, dan mengembalikan respons error.
   * @param exception - Pengecualian yang ditangkap (bisa HttpException atau lainnya).
   * @param host - Konteks eksekusi NestJS yang berisi informasi request/response.
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Tentukan status HTTP
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    // Ambil request ID dari header
    const requestIdHeader = request.headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string'
        ? requestIdHeader
        : Array.isArray(requestIdHeader)
          ? requestIdHeader[0]
          : 'unknown';

    let message: string;
    let additionalFields = {};
    let logError: unknown;

    // Penanganan berdasarkan tipe pengecualian
    if (exception instanceof HttpException) {
      const errorResponse = exception.getResponse() as HttpErrorResponse;
      logError = errorResponse;

      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else {
        message =
          typeof errorResponse.message === 'string'
            ? errorResponse.message
            : 'Terjadi kesalahan';
        if (!isProduction && typeof errorResponse === 'object') {
          const { message: _, ...rest } = errorResponse;
          additionalFields = rest;
        }
      }
    } else {
      message = 'Terjadi kesalahan';
      logError = exception;
    }

    // Log error dengan konteks
    this.logger.error(
      `HTTP ${status} at ${request.method} ${request.url} (Request ID: ${requestId}): ${JSON.stringify(
        {
          status,
          method: request.method,
          url: request.url,
          requestId,
          error: logError,
        },
        null,
        2
      )}`,
      isProduction
        ? 'Stack trace hidden in production'
        : exception instanceof Error
          ? exception.stack
          : String(exception)
    );

    // Kirim respons JSON
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      message,
      ...additionalFields,
    });
  }
}