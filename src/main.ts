import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as cookieParser from 'cookie-parser';
import * as os from 'os';

async function bootstrap() {
  let app;
  try {
    app = await NestFactory.create(AppModule);

    const winstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    app.useLogger(winstonLogger);

    const configService = app.get(ConfigService);
    app.use(cookieParser());

    const nodeEnv = (configService.get('NODE_ENV') as string) || process.env.NODE_ENV || 'development';
    const localIp = getLocalIpAddress() || '127.0.0.1';
    const host = nodeEnv === 'development' ? localIp : (configService.get('HOST') as string) || process.env.HOST || 'localhost';
    const port = (configService.get('PORT') as number) || process.env.PORT || (nodeEnv === 'development' ? 3000 : 3000);
    const protocol = (configService.get('PROTOCOL') as string) || process.env.PROTOCOL || (nodeEnv === 'production' ? 'https' : 'http');
    const frontendUrl = (configService.get('FRONTEND_URL') as string) || process.env.FRONTEND_URL || 'http://localhost:4200';

    app.enableCors({
      origin: [frontendUrl, `${protocol}://${host}:4200`],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type,Authorization',
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
