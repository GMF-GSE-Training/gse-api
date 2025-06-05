import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { validationSchema } from './config.validation.js';
import configuration from './configuration.js';

/**
 * Modul untuk mengelola konfigurasi aplikasi menggunakan @nestjs/config.
 * @description Memuat variabel lingkungan dari file .env berdasarkan NODE_ENV dan memvalidasinya.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: getEnvFilePath(),
      validationSchema,
    }),
  ],
})
export class ConfigModule {}

/**
 * Memilih file .env berdasarkan lingkungan aplikasi (NODE_ENV).
 * @returns Path ke file .env yang sesuai (misalnya, .env.development).
 */
function getEnvFilePath(): string {
  const env = process.env.NODE_ENV || 'development';
  let envFilePath: string;

  switch (env) {
    case 'production':
      envFilePath = '.env.production';
      break;
    case 'staging':
      envFilePath = '.env.staging';
      break;
    case 'development':
    default:
      envFilePath = '.env.development';
      break;
  }

  // Logging opsional untuk debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`Loading environment variables from: ${envFilePath}`);
  }

  return envFilePath;
}
