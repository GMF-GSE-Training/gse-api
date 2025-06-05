// akan dihapus
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Service untuk logging terpusat menggunakan Winston.
 * @description Menyediakan logging ke file (error.log, combined.log, dan rotasi harian) serta konsol dengan format JSON.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger;

  /**
   * Konstruktor untuk menginisialisasi logger Winston.
   * @param configService - Service untuk mengakses variabel lingkungan.
   */
  constructor(private readonly configService: ConfigService) {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const logDir = this.configService.get<string>('LOG_DIR', 'logs');

    this.logger = createLogger({
      level: logLevel,
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.json()
      ),
      transports: [
        // Transport untuk error.log
        new transports.File({
          filename: `${logDir}/error.log`,
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        // Transport untuk combined.log
        new transports.File({
          filename: `${logDir}/combined.log`,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        // Transport untuk rotasi harian
        new DailyRotateFile({
          dirname: logDir,
          filename: 'application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),
        // Transport untuk konsol
        new transports.Console({
          format: format.combine(format.colorize(), format.simple()),
        }),
      ],
    });
  }

  /**
   * Mencatat pesan pada level info.
   * @param message - Pesan yang akan dicatat.
   * @param context - Konteks logging (opsional).
   */
  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  /**
   * Mencatat pesan pada level error.
   * @param message - Pesan error yang akan dicatat.
   * @param trace - Stack trace (opsional).
   * @param context - Konteks logging (opsional).
   */
  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context });
  }

  /**
   * Mencatat pesan pada level warn.
   * @param message - Pesan peringatan yang akan dicatat.
   * @param context - Konteks logging (opsional).
   */
  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  /**
   * Mencatat pesan pada level debug.
   * @param message - Pesan debug yang akan dicatat.
   * @param context - Konteks logging (opsional).
   */
  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  /**
   * Mencatat pesan pada level verbose.
   * @param message - Pesan verbose yang akan dicatat.
   * @param context - Konteks logging (opsional).
   */
  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }
}
