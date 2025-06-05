import type { Address } from '@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface.js';

/**
 * Request untuk mengirim email.
 * @remarks Mendukung pengiriman email dengan template dan penggantian placeholder.
 */
export interface SendEmail {
  from: Address;
  recipients: Address[];
  subject: string;
  html?: string;
  template?: string;
  context?: Record<string, unknown>;
  placeholderReplacements?: Record<string, string>;
}
