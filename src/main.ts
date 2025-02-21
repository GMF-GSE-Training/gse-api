import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as cookieParser from 'cookie-parser';
import * as os from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  app.use(cookieParser());

  // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost'; // Default fallback

  // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    if (addresses) {
      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
          break;
        }
      }
    }
  }

  const host = localIp || process.env.HOST;
  const port = process.env.PORT || 3000;

  app.enableCors({
    origin: [`${process.env.ORIGIN}`, `http://${host}:4200`],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type',
    credentials: true,
  });

  await app.listen(port, host);

  console.log(`Application is running on: http://${localIp}:${port}`);
}

bootstrap();
