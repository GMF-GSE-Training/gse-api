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
      statusCode = HttpStatus.BAD_REQUEST;

      if (exception.code === 'P2002') {
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
        errorResponse = {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          status: HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR],
          errors: 'Terjadi kesalahan pada database.',
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
        errors: 'Terjadi kesalahan internal pada layer database.',
      };
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        code: statusCode,
        status: HttpStatus[statusCode],
        errors: exception.message,
      };
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
