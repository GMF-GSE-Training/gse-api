import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { Request } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Strategy, StrategyOptionsWithRequest } from 'passport-google-oauth20';
import { z } from 'zod';

import { OAuthProvider } from '../model/auth.model.js';

import { AuthService } from './auth.service.js';

/**
 * Strategi Passport untuk autentikasi Google OAuth2.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  /**
   * @param authService - Service untuk autentikasi.
   * @param configService - Service untuk konfigurasi.
   * @param logger - Logger untuk mencatat aktivitas.
   */
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
    @InjectPinoLogger(GoogleStrategy.name) private readonly logger: PinoLogger
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
      state: true,
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);

    // Validasi konfigurasi setelah super
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientID || !clientSecret || !callbackURL) {
      this.logger.error('Google OAuth configuration is missing', {
        context: 'GoogleStrategy',
      });
      throw new BadRequestException('Google OAuth configuration is missing');
    }

    this.logger.debug(
      `Google OAuth strategy initialized with callback: ${callbackURL}`,
      { context: 'GoogleStrategy' }
    );
  }

  /**
   * Skema validasi untuk profil pengguna dari Google.
   */
  private readonly profileSchema = z.object({
    id: z.string().min(1, 'Google ID is required'),
    emails: z
      .array(z.object({ value: z.string().email() }))
      .min(1, 'At least one email is required'),
    displayName: z.string().min(1, 'Display name is required').optional(),
  });

  /**
   * Memvalidasi token Google OAuth dan memproses profil pengguna.
   * @param req Objek request Express.
   * @param accessToken Token akses OAuth.
   * @param refreshToken Token refresh (jika tersedia).
   * @param profile Profil pengguna dari Google.
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
      this.logger.debug('Validating Google OAuth profile', {
        context: 'GoogleStrategy',
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
          `Invalid Google profile: ${validatedProfile.error.message}`,
          { context: 'GoogleStrategy', requestId }
        );
        throw new BadRequestException('Invalid Google profile data');
      }

      const { id, emails, displayName } = validatedProfile.data;
      const email = emails[0].value;
      const name = displayName || email.split('@')[0];

      this.logger.debug(`Processing user: ${email}`, {
        context: 'GoogleStrategy',
        requestId,
      });

      const user = {
        oauthId: id,
        email,
        name,
        provider: OAuthProvider.GOOGLE,
        state: req.query.state as string,
      };

      const authResponse = await this.authService.oauthLogin(user);
      this.logger.info(`User authenticated via Google: ${email}`, {
        context: 'GoogleStrategy',
        requestId,
        userId: authResponse.id,
      });
      done(null, authResponse);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Google OAuth validation failed: ${errorMessage}`, {
        context: 'GoogleStrategy',
        requestId,
        stack: errorStack,
      });
      done(error instanceof Error ? error : new Error(errorMessage), null);
    }
  }
}
