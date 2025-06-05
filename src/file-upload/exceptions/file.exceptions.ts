import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for file-related errors with metadata support.
 */
export class FileException extends BadRequestException {
  /**
   *
   * @param message
   * @param metadata
   */
  constructor(
    message: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.metadata = metadata ?? { timestamp: new Date() };
  }
}

/**
 * Exception for file validation errors (e.g., invalid MIME type, file size).
 */
export class FileValidationException extends FileException {
  /**
   *
   * @param message
   * @param metadata
   */
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, metadata);
  }
}

/**
 * Exception for storage operation failures (e.g., upload, download, delete).
 */
export class StorageOperationException extends HttpException {
  /**
   *
   * @param message
   * @param status
   * @param metadata
   */
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    metadata?: Record<string, any>
  ) {
    super(message, status);
    this.metadata = metadata ?? { timestamp: new Date() };
  }

  public readonly metadata: Record<string, any>;
}

/**
 * Exception for configuration errors (e.g., invalid encryption key, storage type).
 */
export class ConfigurationException extends HttpException {
  /**
   *
   * @param message
   * @param metadata
   */
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
    this.metadata = metadata ?? { timestamp: new Date() };
  }

  public readonly metadata: Record<string, any>;
}
