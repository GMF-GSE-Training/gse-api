import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { SendEmail } from 'src/model/mail.model';
import { ConfigService } from '@nestjs/config';
import { FileUploadService } from '../file-upload/file-upload.service';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async sendEmail(email: SendEmail) {
    const { from, receptients, subject, html, placeholderReplacements } = email;
    // Ambil path logo dan bucket public dari config/env
    const logoPath = this.configService.get<string>('logoPath') || 'logo_gmf_putih.png';
    let publicBucket = this.configService.get<string>('publicBucket');
    console.log('[MailService] ConfigService publicBucket:', publicBucket);
    if (!publicBucket) {
      publicBucket = process.env.SUPABASE_PUBLIC_BUCKET;
      console.log('[MailService] Fallback process.env.SUPABASE_PUBLIC_BUCKET:', publicBucket);
    }
    let logoUrl = '';
    if (this.fileUploadService && this.fileUploadService.provider && typeof this.fileUploadService.provider.getPublicUrl === 'function') {
      logoUrl = this.fileUploadService.provider.getPublicUrl(logoPath, publicBucket);
      console.log('[MailService] logoUrl generated:', logoUrl);
    }
    try {
      const result = await this.mailerService.sendMail({
        from,
        to: receptients,
        subject,
        template: html,
        context: {
          ...(placeholderReplacements || {}),
          logoUrl,
        },
      });
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error; // Atau tangani error sesuai kebutuhan
    }
  }
}
