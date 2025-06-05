import { Injectable } from '@nestjs/common';

import { MailerService } from '@nestjs-modules/mailer';

import { SendEmail } from '../model/mail.model.js';

/**
 *
 */
@Injectable()
export class MailService {
  /**
   *
   * @param mailerService
   */
  constructor(private readonly mailerService: MailerService) {}

  /**
   *
   * @param email
   */
  async sendEmail(email: SendEmail) {
    const { from, recipients, subject, template, context } = email;
    try {
      const result = await this.mailerService.sendMail({
        from,
        to: recipients,
        subject,
        template, //: html
        context, //: placeholderReplacements
      });
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error; // Atau tangani error sesuai kebutuhan
    }
  }
}
