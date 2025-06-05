import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter.js';

import { MailService } from './mail.service.js';

/**
 *
 */
@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAIL_HOST'),
          port: configService.get<number>('MAIL_PORT'), // 587
          secure: false, // false untuk port 587
          auth: {
            user: configService.get<string>('MAIL_USER'), // your Gmail address
            pass: configService.get<string>('MAIL_PASS'), // App Password atau Gmail password
          },
        },
        defaults: {
          from: {
            name: configService.get<string>('APP_NAME'),
            address: configService.get<string>('MAIL_USER'),
          },
        },
        template: {
          dir: join(__dirname, '../templates/emails'),
          adapter: new EjsAdapter(),
          options: {
            strict: false,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
