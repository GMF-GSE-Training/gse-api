import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, string>
  implements OnModuleInit
{
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    super({
      log: [
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'query',
        },
      ],
    });
  }

  onModuleInit() {
    this.$on('info', (e) => {
      this.logger.info(e);
    });

    this.$on('warn', (e) => {
      this.logger.warn(e);
    });

    this.$on('error', (e) => {
      this.logger.error(e);
    });

    this.$on('query', (e) => {
      this.logger.info(e);
    });
  }

//   async createTemporaryRegistration(data: Prisma.TemporaryRegistrationCreateInput) {
//     return this.temporaryRegistration.create({
//       data,
//     });
//   }

//   async findTemporaryRegistrationByToken(token: string) {
//     return this.temporaryRegistration.findUnique({
//       where: { verificationToken: token },
//     });
//   }

//   async verifyTemporaryRegistration(token: string) {
//     return this.temporaryRegistration.update({
//       where: { verificationToken: token },
//       data: { isVerified: true },
//     });
//   }

//   async deleteExpiredRegistrations() {
//     return this.temporaryRegistration.deleteMany({
//       where: { expiresAt: { lt: new Date() } },
//     });
//   }
}
