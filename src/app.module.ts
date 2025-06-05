import { randomUUID } from 'crypto';
import { join } from 'path';

import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';

import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from './app-config/app-config.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CapabilityModule } from './capability/capability.module.js';
import { CertificateModule } from './certificate/certificate.module.js';
import { CommonModule } from './common/common.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { CotModule } from './cot/cot.module.js';
import { CsrfModule } from './csrf/csrf.module.js';
import { CurriculumSyllabusModule } from './curriculum-syllabus/curriculum-syllabus.module.js';
import { ESignModule } from './e-sign/e-sign.module.js';
import { FileUploadModule } from './file-upload/file-upload.module.js';
import { ParticipantModule } from './participant/participant.module.js';
import { ParticipantCotModule } from './participant-cot/participant-cot.module.js';
import { RoleModule } from './role/role.module.js';
import { SharedModule } from './shared/shared.module.js';
import { UserModule } from './user/user.module.js';

/**
 *
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const logLevel = configService.get<string>('LOG_LEVEL', 'info');
        const logDir = configService.get<string>('LOG_DIR', 'logs');
        const appName = configService.get<string>(
          'APP_NAME',
          'Certificate-Management'
        );
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const sensitivePattern =
          /password|token|accessToken|refreshToken|nik|email|idNumber|name|phoneNumber|address|csrf/i;

        return {
          pinoHttp: {
            level: logLevel,
            transport: {
              targets: [
                {
                  target: 'pino/file',
                  options: {
                    destination: `${logDir}/application.log`,
                    mkdir: true,
                  },
                  level: 'info',
                },
                {
                  target: 'pino/file',
                  options: { destination: `${logDir}/error.log`, mkdir: true },
                  level: 'error',
                },
                ...(nodeEnv !== 'production'
                  ? [
                      {
                        target: 'pino-pretty',
                        options: {
                          colorize: true,
                          translateTime: 'SYS:yyyy-mm-dd HH:mm:ss',
                          ignore: 'pid,hostname',
                        },
                        level: 'debug',
                      },
                    ]
                  : []),
              ],
            },
            formatters: {
              // Changed Record<string, any> to Record<string, unknown> to avoid no-explicit-any error
              log: (object: Record<string, unknown>) => {
                const sanitized = { ...object };
                Object.keys(sanitized).forEach(key => {
                  if (
                    sensitivePattern.test(key) ||
                    (typeof sanitized[key] === 'string' &&
                      sensitivePattern.test(sanitized[key] as string))
                  ) {
                    sanitized[key] = '[REDACTED]';
                  }
                });
                return sanitized;
              },
            },
            customProps: () => ({
              app: appName,
              environment: nodeEnv,
            }),
            redact: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.token',
              'req.body._csrf',
            ],
            genReqId: req => {
              const reqId = req.headers['x-request-id'];
              // Replaced require('crypto').randomUUID() with imported randomUUID
              return reqId || randomUUID();
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/public',
    }),
    CommonModule,
    SharedModule,
    AppConfigModule,
    AuthModule,
    UserModule,
    RoleModule,
    ParticipantModule,
    CapabilityModule,
    CurriculumSyllabusModule,
    CotModule,
    ParticipantCotModule,
    ESignModule,
    CertificateModule,
    FileUploadModule,
    CsrfModule,
  ],
  controllers: [],
  providers: [
    {
      provide: 'APP_FILTER',
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {
  /**
   *
   */
  constructor() {
    const logger = new Logger(AppModule.name);
    logger.debug(
      `Serving static files from: ${join(__dirname, '..', 'public')}`
    );
  }
}
