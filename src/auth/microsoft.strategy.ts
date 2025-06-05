import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { Request } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Strategy } from 'passport-microsoft';
import { z } from 'zod';

import { OAuthProvider } from '../model/auth.model.js';

import { AuthService } from './auth.service.js';

/**
 * Strategi Passport untuk autentikasi Microsoft OAuth2.
 */
@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  /**
   * @param authService - Service untuk autentikasi.
   * @param configService - Service untuk konfigurasi.
   * @param logger - Logger untuk mencatat aktivitas.
   */
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
    @InjectPinoLogger(MicrosoftStrategy.name)
    private readonly logger: PinoLogger
  ) {
    super({
      clientID: configService.get<string>('MICROSOFT_CLIENT_ID') || '',
      clientSecret: configService.get<string>('MICROSOFT_CLIENT_SECRET') || '',
      callbackURL:
        configService.get<string>('MICROSOFT_CALLBACK_URL') ||
        'http://localhost:3000/auth/microsoft/callback',
      scope: ['user.read', 'email', 'profile'],
      tenant: 'common',
      state: true,
      passReqToCallback: true,
    });

    // Validasi konfigurasi setelah super
    const clientID = configService.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = configService.get<string>('MICROSOFT_CLIENT_SECRET');
    const callbackURL = configService.get<string>('MICROSOFT_CALLBACK_URL');

    if (!clientID || !clientSecret || !callbackURL) {
      this.logger.error('Microsoft OAuth configuration is missing', {
        context: 'MicrosoftStrategy',
      });
      throw new BadRequestException('Microsoft OAuth configuration is missing');
    }

    this.logger.debug(
      `Microsoft OAuth strategy initialized with callback: ${callbackURL}`,
      { context: 'MicrosoftStrategy' }
    );
  }

  /**
   * Skema validasi untuk profil pengguna dari Microsoft.
   */
  private readonly profileSchema = z
    .object({
      id: z.string().min(1, 'Microsoft ID is required'),
      mail: z.string().email().nullable(),
      userPrincipalName: z.string().email().nullable(),
      displayName: z.string().min(1, 'Display name is required').optional(),
    })
    .refine(data => data.mail || data.userPrincipalName, {
      message: 'At least one email field is required',
    });

  /**
   * Memvalidasi token Microsoft OAuth dan memproses profil pengguna.
   * @param req Objek request Express.
   * @param accessToken Token akses OAuth.
   * @param refreshToken Token refresh (jika tersedia).
   * @param profile Profil pengguna dari Microsoft.
   * @param done Callback untuk mengembalikan hasil.
   */
  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string | undefined,
    profile: unknown,
    done: (err: Error | null, user?: unknown) => void
  ): Promise<void> {
    const requestId =
      (req.headers['x-request-id'] as string) || crypto.randomUUID();
    try {
      this.logger.debug('Validating Microsoft OAuth profile', {
        context: 'MicrosoftStrategy',
        requestId,
        accessToken: accessToken.substring(0, 10) + '...',
        refreshToken: refreshToken
          ? refreshToken.substring(0, 10) + '...'
          : 'none',
      });

      // Validasi profil menggunakan Zod
      const validatedProfile = this.profileSchema.safeParse(profile);
      if (!validatedProfile.success) {
        this.logger.error(
          `Invalid Microsoft profile: ${validatedProfile.error.message}`,
          { context: 'MicrosoftStrategy', requestId }
        );
        throw new BadRequestException('Invalid Microsoft profile data');
      }

      const { id, mail, userPrincipalName, displayName } =
        validatedProfile.data;
      const email = mail || userPrincipalName;
      if (!email) {
        this.logger.error('No valid email provided by Microsoft OAuth', {
          context: 'MicrosoftStrategy',
          requestId,
        });
        throw new BadRequestException('Email not provided by Microsoft OAuth');
      }

      const name = displayName || email.split('@')[0];

      this.logger.debug(`Processing user: ${email}`, {
        context: 'MicrosoftStrategy',
        requestId,
      });

      const user = {
        oauthId: id,
        email,
        name,
        provider: OAuthProvider.MICROSOFT,
        state: req.query.state as string,
      };

      const authResponse = await this.authService.oauthLogin(user);
      this.logger.info(`User authenticated via Microsoft: ${email}`, {
        context: 'MicrosoftStrategy',
        requestId,
        userId: authResponse.id,
      });
      done(null, authResponse);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Microsoft OAuth validation failed: ${errorMessage}`, {
        context: 'MicrosoftStrategy',
        requestId,
        stack: errorStack,
      });
      done(error instanceof Error ? error : new Error(errorMessage), null);
    }
  }
}
