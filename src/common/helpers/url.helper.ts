import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 *
 */
@Injectable()
export class UrlHelper {
  private readonly logger = new Logger(UrlHelper.name);

  /**
   *
   * @param configService
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   *
   * @param type
   */
  getBaseUrl(type: 'frontend' | 'backend'): string {
    const protocol = this.configService.get<string>('PROTOCOL') || 'http';
    const host = this.configService.get<string>('HOST') || 'localhost';
    const port =
      this.configService.get<string>(
        type === 'frontend' ? 'FRONTEND_PORT' : 'PORT'
      ) || (type === 'frontend' ? '4200' : '3000');

    const envUrl = this.configService.get<string>(
      type === 'frontend' ? 'FRONTEND_URL' : 'BACKEND_URL'
    );
    if (envUrl) {
      this.logger.debug(`Menggunakan ${type} URL dari .env: ${envUrl}`);
      return envUrl;
    }

    const constructedUrl = `${protocol}://${host}:${port}`;
    this.logger.warn(
      `Tidak ada ${type} URL di .env, menggunakan URL default: ${constructedUrl}`
    );
    return constructedUrl;
  }
}
