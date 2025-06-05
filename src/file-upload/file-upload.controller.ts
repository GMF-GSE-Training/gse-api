import * as zlib from 'zlib';

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpStatus,
  Logger,
  UseGuards,
  Query,
  BadRequestException,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import type { Response, Request } from 'express';

import { JwtAuthGuard } from '../shared/guard/jwt-auth.guard.js';

import { StorageOperationException } from './exceptions/file.exceptions.js';
import { FileUploadService } from './file-upload.service.js';

/**
 * Controller for handling file upload, download, and deletion operations.
 * @description Provides REST endpoints for managing files with JWT authentication, rate limiting, and OpenAPI documentation.
 * All endpoints are protected by JWT authentication and include structured logging for traceability.
 * @example
 * // Upload a file
 * POST /file-upload/123e4567-e89b-12d3-a456-426614174000/ktp
 * Content-Type: multipart/form-data
 * Authorization: Bearer <jwt-token>
 *
 * // Download a file
 * GET /file-upload/1
 * Authorization: Bearer <jwt-token>
 */
@ApiTags('File Upload')
@Controller('file-upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileUploadController {
  private readonly logger = new Logger(FileUploadController.name);
  private readonly allowedSubfolders = [
    'simA',
    'simB',
    'ktp',
    'foto',
    'suratSehatButaWarna',
    'suratBebasNarkoba',
    'qrCode',
  ];

  /**
   *
   * @param fileUploadService
   */
  constructor(private readonly fileUploadService: FileUploadService) {}

  /**
   * Uploads a file for a specific participant to a designated subfolder.
   * @param participantId UUID of the participant (validated by ParseUUIDPipe).
   * @param subfolder Subfolder for file storage (e.g., 'ktp', 'simA').
   * @param file File to be uploaded, processed by Multer.
   * @param isSensitive Query parameter to indicate if the file is sensitive (default: true).
   * @param req Express request object for accessing requestId.
   * @returns Object containing file ID, path, and success message.
   * @throws BadRequestException If no file is provided or subfolder is invalid.
   * @throws FileValidationException If input validation fails in service.
   * @throws StorageOperationException If storage operation fails.
   * @example
   * POST /file-upload/123e4567-e89b-12d3-a456-426614174000/ktp?isSensitive=true
   * Content-Type: multipart/form-data
   * file: <file>
   */
  @Post(':participantId/:subfolder')
  @Throttle({ default: { limit: 10, ttl: 60 } }) // 10 requests per minute
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file for a participant' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'participantId',
    type: String,
    description: 'UUID of the participant',
  })
  @ApiParam({
    name: 'subfolder',
    type: String,
    description: 'Storage subfolder (e.g., ktp, simA)',
    enum: [
      'simA',
      'simB',
      'ktp',
      'foto',
      'suratSehatButaWarna',
      'suratBebasNarkoba',
      'qrCode',
    ],
  })
  @ApiQuery({
    name: 'isSensitive',
    type: String,
    required: false,
    description: 'Whether the file is sensitive (true/false, default: true)',
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: Object,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or subfolder' })
  @ApiResponse({ status: 500, description: 'Server error' })
  async upload(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Param('subfolder') subfolder: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('isSensitive') isSensitive: string = 'true',
    @Req() req: Request
  ) {
    const requestId = req.headers['x-request-id'] as string;
    const logContext = {
      participantId,
      subfolder,
      fileName: file?.originalname,
      operation: 'upload',
      requestId,
    };
    this.logger.log('Received upload request', logContext);

    try {
      if (!this.allowedSubfolders.includes(subfolder)) {
        this.logger.error(`Invalid subfolder: ${subfolder}`, logContext);
        throw new BadRequestException(
          `Invalid subfolder. Allowed: ${this.allowedSubfolders.join(', ')}`
        );
      }
      if (!file) {
        this.logger.error('No file uploaded', logContext);
        throw new BadRequestException('No file uploaded');
      }

      const isSensitiveBool = isSensitive === 'false' ? false : true;
      const result = await this.fileUploadService.uploadFile(
        file,
        participantId,
        subfolder,
        isSensitiveBool,
        requestId
      );

      this.logger.log('File uploaded successfully', {
        ...logContext,
        fileId: result.fileId,
        path: result.path,
      });
      return {
        statusCode: HttpStatus.CREATED,
        message: 'File uploaded successfully',
        data: { fileId: result.fileId, path: result.path },
      };
    } catch (error) {
      this.logger.error(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        logContext
      );
      throw error;
    }
  }

  /**
   * Downloads a file by its ID with optional gzip compression.
   * @param fileId Unique ID of the file from FileMetadata.
   * @param res Express response object for setting headers and streaming.
   * @param req Express request object for accessing requestId.
   * @returns File stream with appropriate headers and optional gzip compression.
   * @throws FileValidationException If file ID is invalid or file is not found.
   * @throws StorageOperationException If retrieval fails.
   * @example
   * GET /file-upload/1
   * Accept-Encoding: gzip
   */
  @Get(':fileId')
  @Throttle({ default: { limit: 20, ttl: 60 } }) // 20 requests per minute
  @ApiOperation({ summary: 'Download a file by ID' })
  @ApiParam({ name: 'fileId', type: Number, description: 'Unique file ID' })
  @ApiResponse({
    status: 200,
    description: 'File downloaded successfully',
    content: { 'application/octet-stream': {} },
  })
  @ApiResponse({ status: 400, description: 'Invalid file ID' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async download(
    @Param('fileId') fileId: number,
    @Res() res: Response,
    @Req() req: Request
  ) {
    const requestId = req.headers['x-request-id'] as string;
    const logContext = { fileId, operation: 'download', requestId };
    this.logger.log('Received download request', logContext);

    try {
      const { buffer, mimeType } = await this.fileUploadService.getFile(
        fileId,
        requestId
      );

      res.set({
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="file-${fileId}"`,
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'none'",
      });

      if (res.req?.acceptsEncodings('gzip')) {
        res.set('Content-Encoding', 'gzip');
        this.logger.debug('Applying gzip compression', logContext);
        res.send(zlib.gzipSync(buffer));
      } else {
        res.send(buffer);
      }

      this.logger.log('File downloaded successfully', {
        ...logContext,
        mimeType,
      });
    } catch (error) {
      this.logger.error(
        `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        logContext
      );
      throw error;
    }
  }

  /**
   * Deletes a file by its ID.
   * @param fileId Unique ID of the file from FileMetadata.
   * @param req Express request object for accessing requestId.
   * @returns Success message with status code.
   * @throws FileValidationException If file ID is invalid.
   * @throws StorageOperationException If deletion fails.
   * @example
   * DELETE /file-upload/1
   */
  @Delete(':fileId')
  @Throttle({ default: { limit: 10, ttl: 60 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Delete a file by ID' })
  @ApiParam({ name: 'fileId', type: Number, description: 'Unique file ID' })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
    type: Object,
  })
  @ApiResponse({ status: 400, description: 'Invalid file ID' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async delete(@Param('fileId') fileId: number, @Req() req: Request) {
    const requestId = req.headers['x-request-id'] as string;
    const logContext = { fileId, operation: 'delete', requestId };
    this.logger.log('Received delete request', logContext);

    try {
      await this.fileUploadService.deleteFile(fileId, requestId);
      this.logger.log('File deleted successfully', logContext);
      return {
        statusCode: HttpStatus.OK,
        message: 'File deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        logContext
      );
      throw error;
    }
  }

  /**
   * Checks the health of storage providers and database.
   * @returns Object with provider and database status.
   * @throws StorageOperationException If health check fails.
   * @example
   * GET /file-upload/health
   */
  @Get('health')
  @Throttle({ default: { limit: 10, ttl: 60 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Check system health' })
  @ApiResponse({
    status: 200,
    description: 'Health check results',
    type: Object,
  })
  @ApiResponse({ status: 500, description: 'Health check failed' })
  async checkHealth() {
    const logContext = { operation: 'health' };
    this.logger.log('Received health check request', logContext);

    try {
      const health = await this.fileUploadService.checkHealth();
      this.logger.log('Health check completed', { ...logContext, health });
      return {
        statusCode: HttpStatus.OK,
        message: 'Health check completed',
        data: health,
      };
    } catch (error) {
      this.logger.error(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        logContext
      );
      throw new StorageOperationException(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        logContext
      );
    }
  }
}
