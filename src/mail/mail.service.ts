import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { SendEmail } from 'src/model/mail.model';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendEmail(email: SendEmail) {
    const { from, receptients, subject, html, placeholderReplacements } = email;
    try {
      const result = await this.mailerService.sendMail({
        from,
        to: receptients,
        subject,
        template: html,
        context: placeholderReplacements,
      });
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error; // Atau tangani error sesuai kebutuhan
    }
  }
}
