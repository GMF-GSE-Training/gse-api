import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as cookieParser from 'cookie-parser';
import * as os from 'os';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  let app;
  try {
    app = await NestFactory.create<NestExpressApplication>(AppModule);

    const winstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    app.useLogger(winstonLogger);

    app.useStaticAssets(join(__dirname, '..', 'public'));

    const configService = app.get(ConfigService);
    app.use(cookieParser());

    const nodeEnv = (configService.get('NODE_ENV') as string) || process.env.NODE_ENV || 'development';
    // const localIp = getLocalIpAddress() || '127.0.0.1';
    // const host = nodeEnv === 'development' ? localIp : (configService.get('HOST') as string) || process.env.HOST || 'localhost';
    const host = (configService.get('HOST') as string) || 'localhost';
    const port = (configService.get('PORT') as number) || process.env.PORT || (nodeEnv === 'development' ? 3000 : 3000);
    const protocol = (configService.get('PROTOCOL') as string) || process.env.PROTOCOL || (nodeEnv === 'production' ? 'https' : 'http');
    // Ambil origin CORS dari env, support multi-origin (pisahkan dengan koma)
    const corsOrigins = (configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || configService.get('ORIGIN') || process.env.ORIGIN || 'http://localhost:4200')
      .split(',')
      .map(origin => origin.trim());

    app.enableCors({
      origin: corsOrigins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type,Authorization,Cache-Control',
      credentials: true,
    });

    await app.listen(port, host);
    winstonLogger.log(`Application is running in ${nodeEnv} mode on ${protocol}://${host}:${port})`);
  } catch (error) {
    const fallbackLogger = console;
    const logger = app?.get(WINSTON_MODULE_NEST_PROVIDER) || { error: (msg: string) => fallbackLogger.error(msg) };
    logger.error(`Failed to start application: ${error.message}`, error.stack);
    process.exit(1);
  }
}

function getLocalIpAddress(): string | undefined {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const iface = interfaces[interfaceName];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
          return alias.address;
        }
      }
    }
  }
  return undefined;
}

bootstrap();
