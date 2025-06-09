import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

import { PrismaClient } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * Service untuk mengelola koneksi Prisma dan logging.
 * @description Menginisialisasi PrismaClient dan mengarahkan log ke Pino.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * @param logger - Logger untuk mencatat aktivitas.
   */
  constructor(
    @InjectPinoLogger(PrismaService.name) private readonly logger: PinoLogger
  ) {
    super({
      log: [
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'query' },
      ],
    });
  }

  /**
   * Menginisialisasi koneksi Prisma dan mengatur logging.
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.info('Prisma connected to database successfully');

      (this.$on as any)('info', (e: any) => {
        this.logger.info(e.message);
      });

      (this.$on as any)('warn', (e: any) => {
        this.logger.warn(e.message);
      });

      (this.$on as any)('error', (e: any) => {
        this.logger.error(e.message);
      });

      (this.$on as any)('query', (e: any) => {
        const sanitizedQuery = e.query.replace(
          /(password|nik|email|idNumber|name)\s*=\s*['"][^'"]*['"]/gi,
          '$1 = [REDACTED]'
        );
        this.logger.debug(`Query: ${sanitizedQuery} Duration: ${e.duration}ms`);
      });
    } catch (error) {
      this.logger.error('Failed to connect to database', {
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  /**
   * Menutup koneksi Prisma.
   */
  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.info('Prisma disconnected from database');
  }
}
