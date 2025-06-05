// tidak lagi digunakan karena migrasi ke pino
import * as winston from 'winston';
import { utilities as nestWinstonUtils } from 'nest-winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';
import { TransformableInfo } from 'logform';
import * as ElasticsearchTransport from 'winston-elasticsearch';

/**
 * Konfigurasi logger Winston untuk NestJS.
 * @description Menyediakan logging ke konsol, file statis, file rotasi harian, dan Elasticsearch dengan sanitasi data sensitif, metadata kaya, dan optimasi performa.
 * @param configService - Service untuk mengakses variabel lingkungan.
 */
export const winstonConfig = (configService: ConfigService) => {
  const logLevel = configService.get<string>('LOG_LEVEL', 'info');
  const logDir = configService.get<string>('LOG_DIR', 'logs');
  const appName = configService.get<string>('APP_NAME', 'GMF-Training');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const retentionDays = nodeEnv === 'production' ? '7d' : '14d';
  const enableDebug = configService.get<boolean>('ENABLE_DEBUG', nodeEnv !== 'production');
  const elasticsearchUrl = configService.get<string>('ELASTICSEARCH_URL', 'http://localhost:9200');

  // Pola sanitasi yang lebih spesifik
  const sensitivePattern = /password|token|accessToken|refreshToken|nik|email|idNumber|name|phoneNumber|address/i;

  // Fungsi sanitasi untuk message dan metadata
  const sanitizeFormat = winston.format((info: TransformableInfo) => {
    // Sanitasi info.message
    if (typeof info.message === 'string' && sensitivePattern.test(info.message)) {
      info.message = info.message.replace(sensitivePattern, '[REDACTED]');
    }

    // Sanitasi info.metadata dengan pengecekan tipe aman
    if (info.metadata && typeof info.metadata === 'object' && !Array.isArray(info.metadata) && info.metadata !== null) {
      Object.keys(info.metadata).forEach((key) => {
        const value = (info.metadata as Record<string, any>)[key];
        if (sensitivePattern.test(key) || (typeof value === 'string' && sensitivePattern.test(value))) {
          (info.metadata as Record<string, any>)[key] = '[REDACTED]';
        }
      });
    }

    return info;
  });

  // Format dasar untuk semua transport
  const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
    winston.format.metadata(),
    winston.format.errors({ stack: true }),
    sanitizeFormat(),
  );

  return {
    level: enableDebug ? logLevel : logLevel === 'debug' ? 'info' : logLevel, // Nonaktifkan debug di production kecuali diizinkan
    defaultMeta: {
      app: appName,
      environment: nodeEnv,
    },
    transports: [
      // Transport untuk konsol (pengembangan)
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.ms(),
          nestWinstonUtils.format.nestLike(appName, {
            prettyPrint: true,
            colors: nodeEnv !== 'production', // Nonaktifkan warna di production untuk performa
          }),
          sanitizeFormat(),
        ),
      }),
      // Transport untuk file statis error.log
      new winston.transports.File({
        filename: `${logDir}/error.log`,
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true, // Dukung rotasi tanpa kehilangan log
        eol: '\n', // Konsistensi format di semua platform
        format: baseFormat,
      }),
      // Transport untuk file statis combined.log
      new winston.transports.File({
        filename: `${logDir}/combined.log`,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true,
        eol: '\n',
        format: baseFormat,
      }),
      // Transport untuk file log umum (rotasi harian)
      new DailyRotateFile({
        filename: `${logDir}/application-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '10m',
        maxFiles: retentionDays,
        eol: '\n',
        format: baseFormat,
      }),
      // Transport untuk file log error (rotasi harian)
      new DailyRotateFile({
        filename: `${logDir}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: retentionDays,
        level: 'error',
        eol: '\n',
        format: baseFormat,
      }),
      // Transport untuk Elasticsearch (monitoring ELK Stack)
      new ElasticsearchTransport({
        level: 'info',
        clientOpts: { node: elasticsearchUrl },
        indexPrefix: `${appName.toLowerCase()}-logs`,
        indexSuffixPattern: 'YYYY.MM.DD',
        format: baseFormat,
      }),
    ],
  };
};