import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validationSchema } from './config.validation';

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

// Fungsi helper untuk memilih file .env
function getEnvFilePath(): string {
  const env = process.env.NODE_ENV || 'development';
  switch (env) {
    case 'production':
      return '.env.production';
    case 'staging':
      return '.env.staging';
    case 'development':
    default:
      return '.env.development';
  }
}