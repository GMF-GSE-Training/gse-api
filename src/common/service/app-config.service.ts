import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from './prisma.service.js';

/**
 *
 */
@Injectable()
export class AppConfigService implements OnModuleInit {
  /**
   *
   * @param configService
   * @param prismaService
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService
  ) {}

  /**
   *
   */
  async onModuleInit() {
    // Menggunakan type assertion 'as string' karena validasi memastikan nilai ada
    const frontendUrl = this.configService.get('FRONTEND_URL') as string;
    const backendUrl = this.configService.get('BACKEND_URL') as string;
    let appConfig = await this.prismaService.appConfig.findFirst();
    if (!appConfig) {
      await this.prismaService.appConfig.create({
        data: { frontendUrl, backendUrl },
      });
    } else if (
      appConfig.frontendUrl !== frontendUrl ||
      appConfig.backendUrl !== backendUrl
    ) {
      await this.prismaService.appConfig.update({
        where: { id: appConfig.id },
        data: { frontendUrl, backendUrl },
      });
    }
  }

  /**
   *
   */
  async getFrontendUrl(): Promise<string> {
    const appConfig = await this.prismaService.appConfig.findFirst();
    // Menggunakan type assertion 'as string' untuk nilai fallback
    return (
      appConfig?.frontendUrl ||
      (this.configService.get('FRONTEND_URL') as string)
    );
  }

  /**
   *
   */
  async getBackendUrl(): Promise<string> {
    const appConfig = await this.prismaService.appConfig.findFirst();
    // Menggunakan type assertion 'as string' untuk nilai fallback
    return (
      appConfig?.backendUrl || (this.configService.get('BACKEND_URL') as string)
    );
  }
}
