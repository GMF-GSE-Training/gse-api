import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import type { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { v4 as uuid } from 'uuid';

import { AppModule } from './app.module.js';

/**
 * Bootstrap aplikasi NestJS.
 * @description Menginisialisasi aplikasi dengan middleware, logger, dan konfigurasi API.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Validasi environment variables
  const requiredEnvVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_VERIFICATION_SECRET',
    'ENCRYPTION_KEY',
    'RECAPTCHA_SECRET_KEY',
    'MAIL_USER',
    'SESSION_SECRET',
    'CSRF_SECRET',
  ];
  requiredEnvVars.forEach(envVar => {
    if (!configService.get<string>(envVar)) {
      logger.error(`Environment variable ${envVar} tidak ditemukan`);
      process.exit(1);
    }
  });

  // Validasi SESSION_SECRET dan CSRF_SECRET entropy
  const sessionSecret = configService.get<string>('SESSION_SECRET')!;
  const csrfSecret = configService.get<string>('CSRF_SECRET')!;
  if (Buffer.from(sessionSecret).length < 32) {
    logger.error(
      'SESSION_SECRET must have at least 32 bytes of entropy for HMAC-256'
    );
    process.exit(1);
  }
  if (Buffer.from(csrfSecret).length < 32) {
    logger.error('CSRF_SECRET must have at least 32 bytes of entropy');
    process.exit(1);
  }

  // Middleware: Tambahkan x-request-id
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = uuid();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Middleware: Cookie, session, compression, dan keamanan
  app.use(cookieParser());
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 jam
      },
      name: 'connect.sid',
    })
  );
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://storage.googleapis.com'],
          connectSrc: [
            "'self'",
            'https://www.google.com',
            configService.get<string>('FRONTEND_URL', 'http://localhost:4200'),
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests:
            configService.get<string>('NODE_ENV') === 'production' ? [] : null,
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xXssProtection: true,
      frameguard: { action: 'deny' },
      hsts: {
        maxAge: 31536000, // 1 tahun
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // CSRF Middleware menggunakan csrf-csrf
  const { doubleCsrfProtection } = doubleCsrf({
    getSecret: () => csrfSecret,
    getSessionIdentifier: (req: Request) => req.sessionID,
    cookieName: '_csrf',
    cookieOptions: {
      httpOnly: true,
      secure: configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 jam
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: req =>
      req.headers['x-csrf-token'] || req.body['_csrf'],
  });
  app.use(doubleCsrfProtection);

  // Middleware: Logging request
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.log(`Request: ${req.method} ${req.url}`, {
      requestId: req.headers['x-request-id'],
    });
    next();
  });

  // Global pipes untuk validasi
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Konfigurasi environment
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const host = configService.get<string>('HOST', 'localhost');
  const port = configService.get<number>(
    'PORT',
    nodeEnv === 'development' ? 3000 : 3000
  );
  const protocol = configService.get<string>(
    'PROTOCOL',
    nodeEnv === 'production' ? 'https' : 'http'
  );
  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:4200'
  );

  // Konfigurasi CORS
  app.enableCors({
    origin: [frontendUrl, `${protocol}://${host}:4200`],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Request-ID',
      'recaptcha',
    ],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
    maxAge: 3600,
  });

  // Konfigurasi Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Certificate Management API')
    .setDescription(
      'API untuk sistem autentikasi dan manajemen sertifikat berbasis web'
    )
    .setVersion('0.0.3')
    .addBearerAuth()
    .addCookieAuth('connect.sid')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Mulai server
  try {
    await app.listen(port, host);
    logger.log(`Server berjalan di ${protocol}://${host}:${port}`);
    logger.log(
      `Dokumentasi API tersedia di ${protocol}://${host}:${port}/api-docs`
    );
  } catch (error) {
    logger.error('Gagal memulai aplikasi', { stack: (error as Error).stack });
    process.exit(1);
  }
}

bootstrap();
