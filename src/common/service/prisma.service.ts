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
  constructor(
    @InjectPinoLogger(PrismaService.name) private readonly logger: PinoLogger
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.info('Prisma connected to database successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.info('Prisma disconnected from database');
  }
}
