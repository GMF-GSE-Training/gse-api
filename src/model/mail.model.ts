import { Address } from '@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface';

export interface SendEmail {
  from: Address;
  receptients: Address[];
  subject: string;
  html: string;
  placeholderReplacements?: Record<string, any>;
}
