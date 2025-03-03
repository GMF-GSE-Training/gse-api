import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

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
