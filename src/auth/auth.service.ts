import * as crypto from 'crypto';

import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  HttpException,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as QRCode from 'qrcode';
import { firstValueFrom } from 'rxjs';
import sanitizeHtml from 'sanitize-html';
import * as speakeasy from 'speakeasy';
import { z } from 'zod';

import { CoreHelper } from '../common/helpers/core.helper.js';
import { UrlHelper } from '../common/helpers/url.helper.js';
import { AppConfigService } from '../common/service/app-config.service.js';
import { PrismaService } from '../common/service/prisma.service.js';
import { TokenBlacklistService } from '../common/service/token-blacklist.service.js';
import { ValidationService } from '../common/service/validation.service.js';
import { FileUploadService } from '../file-upload/file-upload.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  AuthResponse,
  CurrentUserRequest,
  JwtPayload,
  LoginUserRequest,
  OAuthLoginRequest,
  RegisterUserRequest,
  SendEmail,
  UpdatePassword,
} from '../model/auth.model.js';
import { ParticipantResponse } from '../model/participant.model.js';

import { AuthValidation, AuthResponseSchema } from './auth.validation.js';
import {
  ACCESS_JWT_SERVICE,
  REFRESH_JWT_SERVICE,
  VERIFICATION_JWT_SERVICE,
} from './jwt/jwt.constants.js';
import { CustomJwtService } from './jwt/jwt.service.js';

interface RecaptchaResponse {
  data: {
    success: boolean;
    score?: number;
    action?: string;
    challenge_ts?: string;
    hostname?: string;
    error_codes?: string[];
  };
}

interface UserForPasswordVerification {
  password: string | null;
  hashAlgorithm?: string | null;
}

const OAuthLoginRequestSchema = z.object({
  oauthId: z.string(),
  email: z.string().email(),
  name: z.string(),
  provider: z.enum(['GOOGLE', 'MICROSOFT']),
  photo: z.string().optional().nullable(),
  state: z.string().optional(),
});

/**
 * Service untuk mengelola autentikasi pengguna.
 * @description Menangani registrasi, login, OAuth, manajemen token, dan fitur keamanan seperti 2FA dan token blacklisting.
 */
@Injectable()
export class AuthService {
  private readonly encryptionKey: string;
  private readonly loginAttempts: Map<string, number> = new Map();

  /**
   * Konstruktor untuk AuthService.
   * @param prismaService - Layanan Prisma untuk interaksi dengan database.
   * @param validationService - Layanan untuk validasi data.
   * @param mailService - Layanan untuk pengiriman email.
   * @param configService - Layanan untuk mengakses konfigurasi aplikasi.
   * @param appConfigService - Layanan untuk konfigurasi aplikasi tambahan.
   * @param coreHelper - Helper untuk fungsi inti.
   * @param fileUploadService - Layanan untuk unggah file.
   * @param httpService - Layanan untuk permintaan HTTP.
   * @param urlHelper - Helper untuk manipulasi URL.
   * @param tokenBlacklistService - Layanan untuk manajemen token blacklist.
   * @param accessJwtService - Layanan JWT untuk token akses.
   * @param refreshJwtService - Layanan JWT untuk token refresh.
   * @param verificationJwtService - Layanan JWT untuk token verifikasi.
   * @param logger - Logger untuk mencatat aktivitas.
   */
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
    private readonly coreHelper: CoreHelper,
    private readonly fileUploadService: FileUploadService,
    private readonly httpService: HttpService,
    private readonly urlHelper: UrlHelper,
    private readonly tokenBlacklistService: TokenBlacklistService,
    @Inject(ACCESS_JWT_SERVICE)
    private readonly accessJwtService: CustomJwtService,
    @Inject(REFRESH_JWT_SERVICE)
    private readonly refreshJwtService: CustomJwtService,
    @Inject(VERIFICATION_JWT_SERVICE)
    private readonly verificationJwtService: CustomJwtService,
    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger
  ) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') || '';
    if (!this.encryptionKey) {
      this.logger.error('ENCRYPTION_KEY tidak ditemukan di konfigurasi', {
        context: 'AuthService',
      });
      throw new Error('ENCRYPTION_KEY tidak ditemukan di konfigurasi');
    }
  }

  /**
   * Memastikan role default "user" ada di database.
   * @returns Promise yang mengembalikan void setelah memastikan role ada.
   */
  private async ensureDefaultRole(): Promise<void> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memastikan role default "user" ada`, {
      context: 'AuthService',
      requestId,
    });

    const defaultRole = await this.prismaService.role.findFirst({
      where: { name: { equals: 'user', mode: 'insensitive' } },
    });

    if (!defaultRole) {
      await this.prismaService.role.create({
        data: { id: crypto.randomUUID(), name: 'user' },
      });
      this.logger.info(`Role default "user" dibuat`, {
        context: 'AuthService',
        requestId,
      });
    }
  }

  /**
   * Menghasilkan state untuk OAuth.
   * @param provider - Penyedia OAuth (misalnya, 'google', 'microsoft').
   * @returns Promise yang mengembalikan state yang dihasilkan.
   */
  async generateOAuthState(provider: string): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Menghasilkan state OAuth untuk penyedia: ${provider}`, {
      context: 'AuthService',
      requestId,
    });

    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prismaService.oAuthState.create({
      data: { state, provider, expiresAt },
    });

    this.logger.info(`State OAuth dihasilkan untuk penyedia: ${provider}`, {
      context: 'AuthService',
      requestId,
    });

    return state;
  }

  /**
   * Memverifikasi state OAuth.
   * @param state - State OAuth yang akan diverifikasi.
   * @param provider - Penyedia OAuth.
   * @returns Promise yang mengembalikan true jika state valid, false jika tidak.
   */
  async verifyOAuthState(state: string, provider: string): Promise<boolean> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memverifikasi state OAuth untuk penyedia: ${provider}`, {
      context: 'AuthService',
      requestId,
    });

    const record = await this.prismaService.oAuthState.findUnique({
      where: { state },
    });

    if (
      !record ||
      record.provider !== provider ||
      record.expiresAt < new Date()
    ) {
      this.logger.warn(
        `State OAuth tidak valid atau kadaluarsa untuk penyedia: ${provider}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      return false;
    }

    await this.prismaService.oAuthState.delete({ where: { state } });
    this.logger.info(`State OAuth diverifikasi untuk penyedia: ${provider}`, {
      context: 'AuthService',
      requestId,
    });

    return true;
  }

  /**
   * Mengenkripsi token menggunakan AES-256-CBC.
   * @param token - Token yang akan dienkripsi.
   * @returns Token terenkripsi dalam format hex (IV:encrypted).
   * @throws {BadRequestException} Jika enkripsi gagal.
   */
  private encryptToken(token: string): string {
    try {
      const key = Buffer.from(this.encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(token);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
      this.logger.error(
        `Gagal mengenkripsi token: ${(error as Error).message}`,
        {
          context: 'AuthService',
        }
      );
      throw new BadRequestException(
        'Terjadi kesalahan saat memproses token. Silakan coba lagi.'
      );
    }
  }

  /**
   * Mendekripsi token terenkripsi.
   * @param encryptedToken - Token terenkripsi (IV:encrypted).
   * @returns Token yang telah didekripsi.
   * @throws {BadRequestException} Jika dekripsi gagal.
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const [iv, encrypted] = encryptedToken
        .split(':')
        .map(part => Buffer.from(part, 'hex'));
      const key = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (error) {
      this.logger.error(
        `Gagal mendekripsi token: ${(error as Error).message}`,
        {
          context: 'AuthService',
        }
      );
      throw new BadRequestException(
        'Token terenkripsi tidak valid. Silakan coba lagi.'
      );
    }
  }

  /**
   * Memverifikasi token JWT.
   * @param token - Token JWT yang akan diverifikasi.
   * @param type - Jenis token ('access', 'refresh', atau 'verification').
   * @returns Payload JWT yang telah didekode.
   * @throws {HttpException} Jika token tidak valid atau masuk daftar hitam.
   */
  private async verifyToken(
    token: string,
    type: 'access' | 'refresh' | 'verification'
  ): Promise<JwtPayload> {
    try {
      let payload: JwtPayload;
      if (type === 'access') {
        payload = await this.accessJwtService.verifyAsync(token);
      } else if (type === 'refresh') {
        payload = await this.refreshJwtService.verifyAsync(token);
      } else {
        payload = await this.verificationJwtService.verifyAsync(token);
      }

      if (await this.tokenBlacklistService.isTokenBlacklisted(token)) {
        this.logger.warn(`Token masuk daftar hitam: ${type}`, {
          context: 'AuthService',
          tokenType: type,
        });
        throw new UnauthorizedException(
          'Token tidak valid atau telah dibatalkan.'
        );
      }

      if (type === 'refresh' && payload.sessionId) {
        const sessionExists = await this.prismaService.refreshToken.findFirst({
          where: { sessionId: payload.sessionId },
        });
        if (!sessionExists) {
          this.logger.warn(`Sesi tidak ditemukan: ${payload.sessionId}`, {
            context: 'AuthService',
            sessionId: payload.sessionId,
          });
          throw new UnauthorizedException('Sesi telah dihentikan.');
        }
      }
      return payload;
    } catch (error) {
      this.logger.error(`Verifikasi token gagal: ${(error as Error).message}`, {
        context: 'AuthService',
        tokenType: type,
      });
      throw new HttpException('Token tidak valid atau sudah kadaluarsa.', 401);
    }
  }

  /**
   * Mencatat log audit.
   * @param userId - ID pengguna yang melakukan aksi, nullable.
   * @param action - Jenis aksi yang dilakukan.
   * @param details - Detail tambahan tentang aksi, opsional.
   */
  private async logAudit(
    userId: string | null,
    action: string,
    details?: string
  ): Promise<void> {
    try {
      await this.prismaService.auditLog.create({
        data: { userId, action, details },
      });
    } catch (error) {
      this.logger.error(`Gagal mencatat audit: ${(error as Error).message}`, {
        context: 'AuthService',
        userId,
        action,
      });
    }
  }

  /**
   * Memverifikasi token CAPTCHA dengan API reCAPTCHA Google.
   * @param token - Token CAPTCHA yang akan diverifikasi.
   * @returns Promise yang mengembalikan true jika CAPTCHA valid, false jika tidak.
   * @throws {HttpException} Jika terlalu banyak upaya gagal.
   */
  async verifyCaptcha(token: string): Promise<boolean> {
    const requestId = crypto.randomUUID();
    const secret = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    try {
      const response = await firstValueFrom<RecaptchaResponse>(
        this.httpService.post(
          'https://www.google.com/recaptcha/api/siteverify',
          { secret, response: token }
        )
      );
      const maxAttempts = this.configService.get<number>(
        'RECAPTCHA_MAX_ATTEMPTS',
        5
      );
      if (
        !response.data.success ||
        (response.data.score &&
          response.data.score <
            this.configService.get<number>('RECAPTCHA_SCORE_THRESHOLD', 0.6))
      ) {
        const attempts = await this.prismaService.auditLog.count({
          where: { action: 'CAPTCHA_FAILED' },
        });
        if (attempts >= maxAttempts) {
          throw new HttpException(
            'Terlalu banyak upaya CAPTCHA gagal. Silakan coba lagi nanti.',
            429
          );
        }
        await this.logAudit(null, 'CAPTCHA_FAILED', `Token: ${token}`);
        this.logger.warn(`Validasi CAPTCHA gagal`, {
          context: 'AuthService',
          requestId,
        });
        return false;
      }
      this.logger.debug(`CAPTCHA berhasil diverifikasi`, {
        context: 'AuthService',
        requestId,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Gagal memverifikasi CAPTCHA: ${(error as Error).message}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      return false;
    }
  }

  /**
   * Memeriksa apakah pengguna dengan nomor pegawai atau email sudah ada.
   * @param idNumber - Nomor pegawai, opsional.
   * @param email - Alamat email pengguna, opsional.
   * @throws {HttpException} Jika nomor pegawai atau email sudah digunakan.
   */
  private async checkUserExists(
    idNumber?: string,
    email?: string
  ): Promise<void> {
    if (idNumber) {
      const count = await this.prismaService.user.count({
        where: { idNumber },
      });
      if (count > 0)
        throw new HttpException('Nomor pegawai sudah digunakan.', 400);
    }
    if (email) {
      const count = await this.prismaService.user.count({ where: { email } });
      if (count > 0) throw new HttpException('Email sudah digunakan.', 400);
    }
  }

  /**
   * Menghasilkan token refresh untuk pengguna.
   * @param userId - ID pengguna.
   * @returns Promise yang mengembalikan token refresh terenkripsi.
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Membuat token refresh untuk userId: ${userId}`, {
      context: 'AuthService',
      requestId,
      userId,
    });
    const activeTokens = await this.prismaService.refreshToken.count({
      where: { userId },
    });
    const maxTokens = this.configService.get<number>('MAX_REFRESH_TOKENS', 5);
    if (activeTokens >= maxTokens) {
      const oldestToken = await this.prismaService.refreshToken.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (oldestToken) {
        await this.prismaService.refreshToken.delete({
          where: { id: oldestToken.id },
        });
        await this.tokenBlacklistService.blacklistToken(
          oldestToken.token,
          userId,
          oldestToken.expiresAt
        );
        this.logger.info(
          `Token lama dimasukkan ke daftar hitam untuk userId: ${userId}`,
          {
            context: 'AuthService',
            requestId,
            userId,
          }
        );
      }
    }
    const token = crypto.randomBytes(64).toString('hex');
    const encryptedToken = this.encryptToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionId = crypto.randomUUID();
    await this.prismaService.refreshToken.create({
      data: {
        token: encryptedToken,
        userId,
        expiresAt,
        sessionId,
      } as Prisma.RefreshTokenUncheckedCreateInput,
    });
    this.logger.debug(`Token refresh dibuat untuk userId: ${userId}`, {
      context: 'AuthService',
      requestId,
      userId,
    });
    return encryptedToken;
  }

  /**
   * Menentukan field yang akan dipilih untuk query pengguna.
   * @returns Objek yang menentukan field yang akan dipilih dalam query Prisma.
   */
  private authSelectedFields() {
    return {
      id: true,
      participantId: true,
      idNumber: true,
      email: true,
      name: true,
      nik: true,
      dinas: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      twoFactorEnabled: true,
      twoFactorSecret: true,
      photo: true,
      accountVerificationToken: true,
      verifiedAccount: true,
      verificationSentAt: true,
      passwordResetToken: true,
      updateEmailToken: true,
      loginAttempts: true,
      lockUntil: true,
      password: true,
      hashAlgorithm: true,
      createdAt: true,
      updatedAt: true,
      oauthId: true,
      oauthProvider: true,
      oauthRefreshToken: true,
    };
  }

  /**
   * Mengkonversi objek pengguna parsial ke AuthResponse.
   * @param user - Data pengguna parsial.
   * @returns Objek AuthResponse yang telah diformat.
   * @throws {BadRequestException} Jika data pengguna tidak valid.
   */
  private toAuthResponse(user: Partial<AuthResponse>): AuthResponse {
    try {
      const validated = AuthResponseSchema.parse(user);
      return {
        id: validated.id || '',
        idNumber: validated.idNumber || null,
        email: validated.email || '',
        name: validated.name || '',
        dinas: validated.dinas || null,
        refreshToken: validated.refreshToken || null,
        accessToken: validated.accessToken || '',
        role: validated.role
          ? { id: validated.role.id || '', name: validated.role.name || '' }
          : null,
        participant: validated.participant
          ? ({
              ...validated.participant,
              dateOfBirth: validated.participant.dateOfBirth || null,
              tglKeluarSuratSehatButaWarna:
                validated.participant.tglKeluarSuratSehatButaWarna || null,
              tglKeluarSuratBebasNarkoba:
                validated.participant.tglKeluarSuratBebasNarkoba || null,
              createdAt:
                validated.participant.createdAt || new Date().toISOString(),
              updatedAt:
                validated.participant.updatedAt || new Date().toISOString(),
            } as ParticipantResponse)
          : null,
        isDataComplete: validated.isDataComplete || false,
        expiredAt: validated.expiredAt || undefined,
        photo: validated.photo || null,
      };
    } catch (error) {
      this.logger.error(
        `Gagal memparsing respons autentikasi: ${(error as Error).message}`,
        {
          context: 'AuthService',
        }
      );
      throw new BadRequestException(
        'Data autentikasi tidak valid. Silakan coba lagi.'
      );
    }
  }

  /**
   * Mendaftarkan pengguna baru.
   * @param req - Data permintaan registrasi.
   * @returns Promise yang mengembalikan pesan sukses.
   * @throws {HttpException} Jika validasi gagal atau pengguna sudah ada.
   */
  async register(req: RegisterUserRequest): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memulai registrasi pengguna: ${req.email}`, {
      context: 'AuthService',
      requestId,
    });
    const registerRequest: RegisterUserRequest =
      this.validationService.validate(AuthValidation.REGISTER, {
        ...req,
        email: sanitizeHtml(req.email, {
          allowedTags: [],
          allowedAttributes: {},
        }),
        name: sanitizeHtml(req.name, {
          allowedTags: [],
          allowedAttributes: {},
        }),
        dinas: req.dinas
          ? sanitizeHtml(req.dinas, { allowedTags: [], allowedAttributes: {} })
          : undefined,
      });

    if (!(await this.verifyCaptcha(registerRequest.captchaToken))) {
      throw new HttpException(
        'Validasi CAPTCHA gagal. Silakan coba lagi.',
        400
      );
    }

    if (req.roleId) {
      this.logger.warn('Percobaan menentukan role oleh pengguna', {
        context: 'AuthService',
        requestId,
      });
      throw new HttpException('Anda tidak berhak menentukan role.', 403);
    }

    await this.ensureDefaultRole();
    const defaultRole = await this.prismaService.role.findFirst({
      where: { name: { equals: 'user', mode: 'insensitive' } },
    });
    req.roleId = defaultRole!.id;

    const participant = await this.prismaService.participant.findUnique({
      where: { nik: registerRequest.nik || undefined },
    });
    if (participant) {
      if (registerRequest.email !== participant.email) {
        throw new HttpException('Email tidak sesuai dengan data peserta.', 400);
      }
      if (
        participant.idNumber &&
        registerRequest.idNumber !== participant.idNumber
      ) {
        throw new HttpException(
          'Nomor pegawai tidak sesuai dengan data peserta.',
          400
        );
      }
      if (participant.dinas && registerRequest.dinas !== participant.dinas) {
        throw new HttpException('Dinas tidak sesuai dengan data peserta.', 400);
      }
      req.participantId = participant.id;
    }

    await this.checkUserExists(
      registerRequest.idNumber || undefined,
      registerRequest.email
    );
    const hashedPassword = await argon2.hash(registerRequest.password, {
      memoryCost: this.configService.get<number>('ARGON2_MEMORY_COST', 65536),
      timeCost: this.configService.get<number>('ARGON2_TIME_COST', 3),
      parallelism: this.configService.get<number>('ARGON2_PARALLELISM', 1),
    });

    const [user] = await this.prismaService.$transaction(
      async prisma => {
        await this.coreHelper.ensureUniqueFields(
          'participant',
          [
            {
              field: 'idNumber',
              value: registerRequest.idNumber,
              message: 'Nomor pegawai sudah digunakan.',
            },
            {
              field: 'nik',
              value: registerRequest.nik,
              message: 'NIK sudah digunakan.',
            },
            {
              field: 'email',
              value: registerRequest.email,
              message: 'Email sudah digunakan.',
            },
          ],
          undefined,
          prisma
        );

        const user = await prisma.user.create({
          data: {
            ...registerRequest,
            password: hashedPassword,
            hashAlgorithm: 'argon2',
            verificationSentAt: new Date(),
          } as Prisma.UserUncheckedCreateInput,
          select: this.authSelectedFields(),
        });

        const createParticipantData = {
          idNumber: registerRequest.idNumber,
          name: registerRequest.name,
          nik: registerRequest.nik,
          email: registerRequest.email,
          dinas: registerRequest.dinas,
        };

        const participant = await prisma.participant.create({
          data: createParticipantData as Prisma.ParticipantUncheckedCreateInput,
        });

        const qrCodeLinkTemplate =
          this.configService.get<string>('QR_CODE_LINK');
        const frontendUrl = await this.appConfigService.getFrontendUrl();
        const qrCodeLink = qrCodeLinkTemplate
          ? qrCodeLinkTemplate.replace('{id}', participant.id)
          : `${frontendUrl}/participants/${participant.id}/detail`;
        const qrCodeBase64 = await QRCode.toDataURL(qrCodeLink, { width: 500 });
        const qrCodeBuffer = Buffer.from(
          qrCodeBase64.replace(/^data:image\/png;base64,/, ''),
          'base64'
        );

        const multerQrCode: Partial<Express.Multer.File> = {
          buffer: qrCodeBuffer,
          originalname: `qrcode_${participant.id}.png`,
          mimetype: 'image/png',
          size: qrCodeBuffer.length,
          fieldname: 'file',
          encoding: '7bit',
        };

        const { fileId: qrCodeId } = await this.fileUploadService.uploadFile(
          multerQrCode as Express.Multer.File,
          participant.id,
          'qrcodes',
          false
        );

        await prisma.participant.update({
          where: { id: participant.id },
          data: { qrCodeId: qrCodeId as number, qrCodeLink },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { participantId: participant.id },
        });

        return [user];
      },
      { timeout: 10000 }
    );

    const payload: JwtPayload = { id: user.id };
    const accountVerificationToken =
      await this.verificationJwtService.signAsync(payload);
    const verificationLink = `${this.urlHelper.getBaseUrl('backend')}/auth/verify-account/${accountVerificationToken}`;

    const email: SendEmail = {
      from: {
        name: this.configService.get<string>('APP_NAME') || 'GMF Training',
        address:
          this.configService.get<string>('MAIL_USER') ||
          'no-reply@gmftraining.com',
      },
      recipients: [{ name: user.name, address: user.email }],
      subject: 'Email Verifikasi',
      html: 'verify-account',
      placeholderReplacements: { username: user.name, verificationLink },
    };

    await this.mailService.sendEmail(email);
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { accountVerificationToken, verificationSentAt: new Date() },
    });

    await this.logAudit(
      user.id,
      'REGISTER',
      `Pengguna ${user.email} terdaftar`
    );
    this.logger.info(`Registrasi berhasil untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return 'Registrasi berhasil';
  }

  /**
   * Menangani login OAuth untuk pengguna.
   * @param request - Data permintaan login OAuth.
   * @returns Promise yang mengembalikan respons autentikasi.
   * @throws {HttpException} Jika login OAuth gagal atau email sudah digunakan.
   */
  async oauthLogin(request: OAuthLoginRequest): Promise<AuthResponse> {
    const requestId = crypto.randomUUID();
    this.logger.debug(
      `Memulai login OAuth: ${request.provider} - ${request.email}`,
      {
        context: 'AuthService',
        requestId,
      }
    );
    const validatedRequest = OAuthLoginRequestSchema.parse(request);
    const { oauthId, email, name, provider, photo, state } = validatedRequest;

    if (!state || !(await this.verifyOAuthState(state, provider))) {
      this.logger.error(`State OAuth tidak valid untuk penyedia: ${provider}`, {
        context: 'AuthService',
        requestId,
      });
      throw new HttpException('State OAuth tidak valid atau kadaluarsa.', 400);
    }

    if (!email) {
      this.logger.error(`Email tidak tersedia dari OAuth ${provider}`, {
        context: 'AuthService',
        requestId,
      });
      throw new BadRequestException(
        'Email tidak tersedia dari penyedia OAuth.'
      );
    }

    const oauthIdStr = String(oauthId);
    const oauthProviderStr = String(provider);

    let user = await this.prismaService.user.findFirst({
      where: { oauthId: oauthIdStr, oauthProvider: oauthProviderStr },
      select: this.authSelectedFields(),
    });
    if (!user) {
      const existingUser = await this.prismaService.user.findFirst({
        where: { email },
      });
      if (existingUser) {
        throw new HttpException(
          'Email sudah digunakan dengan metode autentikasi lain.',
          400
        );
      }

      await this.ensureDefaultRole();
      const defaultRole = await this.prismaService.role.findFirst({
        where: { name: { equals: 'user', mode: 'insensitive' } },
      });

      user = await this.prismaService.user.create({
        data: {
          email,
          name,
          oauthId: oauthIdStr,
          oauthProvider: oauthProviderStr,
          roleId: defaultRole!.id,
          verifiedAccount: true,
          photo,
        } as Prisma.UserUncheckedCreateInput,
        select: this.authSelectedFields(),
      });
      await this.logAudit(
        user.id,
        'OAUTH_REGISTER',
        `Pengguna terdaftar melalui OAuth ${oauthProviderStr} dengan email ${email}`
      );
      this.logger.info(
        `Pengguna terdaftar melalui OAuth ${oauthProviderStr}: ${email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
    }

    if (!user) {
      this.logger.error(`Gagal membuat pengguna untuk login OAuth: ${email}`, {
        context: 'AuthService',
        requestId,
      });
      throw new HttpException(
        'Gagal memproses login OAuth. Silakan coba lagi.',
        500
      );
    }

    const sessionId = crypto.randomUUID();
    const payload: JwtPayload = {
      id: user.id,
      sessionId,
      role: user.role,
    };
    const accessToken = await this.accessJwtService.signAsync(payload);
    const refreshToken = await this.generateRefreshToken(user.id);

    await this.logAudit(
      user.id,
      'OAUTH_LOGIN',
      `Pengguna login melalui OAuth ${oauthProviderStr} dengan email ${email}`
    );
    this.logger.info(`Login OAuth berhasil untuk pengguna: ${email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return this.toAuthResponse({
      id: user.id,
      accessToken,
      refreshToken,
      photo: user.photo,
      role: user.role,
    });
  }

  /**
   * Memverifikasi akun pengguna menggunakan token verifikasi.
   * @param token - Token verifikasi.
   * @returns Promise yang mengembalikan respons autentikasi.
   * @throws {HttpException} Jika pengguna atau token tidak valid.
   */
  async accountVerification(token: string): Promise<AuthResponse> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memulai verifikasi akun dengan token`, {
      context: 'AuthService',
      requestId,
    });
    const verifyToken = await this.verifyToken(token, 'verification');
    const user = await this.prismaService.user.findUnique({
      where: { id: verifyToken.id },
      select: this.authSelectedFields(),
    });
    if (!user) {
      this.logger.error(`Pengguna tidak ditemukan untuk verifikasi`, {
        context: 'AuthService',
        requestId,
      });
      throw new HttpException('Pengguna tidak ditemukan.', 404);
    }
    if (
      !user.accountVerificationToken ||
      user.accountVerificationToken !== token
    ) {
      this.logger.error(`Token verifikasi tidak valid atau sudah digunakan`, {
        context: 'AuthService',
        requestId,
        userId: user.id,
      });
      throw new HttpException(
        'Token verifikasi tidak valid atau sudah digunakan.',
        400
      );
    }

    const sessionId = crypto.randomUUID();
    const payload: JwtPayload = {
      id: user.id,
      sessionId,
      role: user.role,
    };
    const refreshToken = await this.generateRefreshToken(user.id);
    const accessToken = await this.accessJwtService.signAsync(payload);

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        accountVerificationToken: null,
        verifiedAccount: true,
        verificationSentAt: null,
      },
    });

    await this.logAudit(
      user.id,
      'ACCOUNT_VERIFIED',
      `Pengguna ${user.email} memverifikasi akun`
    );
    this.logger.info(`Akun diverifikasi untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return this.toAuthResponse({
      id: user.id,
      accessToken,
      refreshToken,
      photo: user.photo,
      role: user.role,
    });
  }

  /**
   * Menangani login pengguna.
   * @param req - Data permintaan login.
   * @returns Promise yang mengembalikan respons autentikasi.
   * @throws {HttpException} Jika login gagal karena kredensial tidak valid atau masalah lain.
   */
  async login(req: LoginUserRequest): Promise<AuthResponse> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memulai login pengguna: ${req.identifier}`, {
      context: 'AuthService',
      requestId,
    });
    const loginRequest: LoginUserRequest = this.validationService.validate(
      AuthValidation.LOGIN,
      req
    );
    if (!(await this.verifyCaptcha(loginRequest.captchaToken))) {
      throw new HttpException(
        'Validasi CAPTCHA gagal. Silakan coba lagi.',
        400
      );
    }

    const rateLimitKey = `login:${loginRequest.identifier}`;
    const attempts = (this.loginAttempts.get(rateLimitKey) || 0) + 1;
    const maxAttempts = this.configService.get<number>('MAX_LOGIN_ATTEMPTS', 5);
    if (attempts > maxAttempts) {
      this.logger.warn(
        `Terlalu banyak upaya login untuk: ${loginRequest.identifier}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      throw new HttpException(
        'Terlalu banyak upaya login. Silakan coba lagi nanti.',
        429
      );
    }
    this.loginAttempts.set(rateLimitKey, attempts);
    setTimeout(() => this.loginAttempts.delete(rateLimitKey), 60 * 1000);

    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [
          { email: loginRequest.identifier },
          { idNumber: loginRequest.identifier },
        ],
      },
      select: this.authSelectedFields(),
    });
    if (!user) {
      this.logger.error(
        `Kredensial tidak valid untuk: ${loginRequest.identifier}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      throw new HttpException(
        'Nomor pegawai, email, atau kata sandi tidak valid.',
        400
      );
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      this.logger.warn(`Akun terkunci untuk pengguna: ${user.email}`, {
        context: 'AuthService',
        requestId,
        userId: user.id,
      });
      throw new HttpException('Akun terkunci. Silakan coba lagi nanti.', 401);
    }

    if (user.password === null) {
      this.logger.error(
        `Kata sandi tidak tersedia untuk pengguna: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException('Kata sandi tidak tersedia untuk akun ini.', 400);
    }

    const isPasswordValid = await this.verifyPassword(
      { password: user.password, hashAlgorithm: user.hashAlgorithm },
      loginRequest.password
    );
    if (!isPasswordValid) {
      const loginAttempts = (user.loginAttempts || 0) + 1;
      const lockoutDuration = this.configService.get<number>(
        'LOCKOUT_DURATION_MINUTES',
        15
      );

      if (loginAttempts >= maxAttempts) {
        await this.prismaService.user.update({
          where: { id: user.id },
          data: {
            loginAttempts,
            lockUntil: new Date(Date.now() + lockoutDuration * 60 * 1000),
          },
        });
        await this.logAudit(
          user.id,
          'ACCOUNT_LOCKED',
          `Akun terkunci untuk email ${user.email}`
        );
        this.logger.warn(
          `Akun terkunci karena terlalu banyak upaya login: ${user.email}`,
          {
            context: 'AuthService',
            requestId,
            userId: user.id,
          }
        );
        throw new HttpException(
          'Akun terkunci karena terlalu banyak upaya login. Silakan coba lagi nanti.',
          401
        );
      }

      await this.prismaService.user.update({
        where: { id: user.id },
        data: { loginAttempts },
      });
      this.logger.error(
        `Kredensial tidak valid untuk pengguna: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException(
        'Nomor pegawai, email, atau kata sandi tidak valid.',
        400
      );
    }

    if (!user.verifiedAccount) {
      this.logger.error(
        `Akun belum diverifikasi untuk pengguna: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException(
        'Akun belum diverifikasi. Silakan verifikasi email Anda.',
        401
      );
    }

    if (user.twoFactorEnabled) {
      if (!loginRequest.twoFactorToken) {
        this.logger.error(
          `Token 2FA diperlukan untuk pengguna: ${user.email}`,
          {
            context: 'AuthService',
            requestId,
            userId: user.id,
          }
        );
        throw new HttpException('Token 2FA diperlukan.', 400);
      }
      const verified = await this.verify2FA(
        { id: user.id } as CurrentUserRequest,
        loginRequest.twoFactorToken
      );
      if (!verified) {
        throw new HttpException('Token 2FA tidak valid.', 400);
      }
    }

    await this.prismaService.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockUntil: null },
    });

    const sessionId = crypto.randomUUID();
    const payload: JwtPayload = {
      id: user.id,
      sessionId,
      role: user.role,
    };
    const accessToken = await this.accessJwtService.signAsync(payload);
    const refreshToken = await this.generateRefreshToken(user.id);

    await this.logAudit(user.id, 'LOGIN', `Pengguna ${user.email} login`);
    this.logger.info(`Login berhasil untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return this.toAuthResponse({
      id: user.id,
      accessToken,
      refreshToken,
      photo: user.photo,
      role: user.role,
    });
  }

  /**
   * Memverifikasi kata sandi pengguna.
   * @param user - Data pengguna yang berisi kata sandi dan algoritma hash.
   * @param password - Kata sandi yang akan diverifikasi.
   * @returns Promise yang mengembalikan true jika kata sandi valid, false jika tidak.
   */
  private async verifyPassword(
    user: UserForPasswordVerification,
    password: string
  ): Promise<boolean> {
    if (user.password === null) {
      return false;
    }
    if (user.hashAlgorithm === 'argon2' || !user.hashAlgorithm) {
      return await argon2.verify(user.password, password);
    } else if (user.hashAlgorithm === 'bcrypt') {
      return await bcrypt.compare(password, user.password);
    }
    return false;
  }

  /**
   * Memperbarui token akses dan refresh.
   * @param oldRefreshToken - Token refresh yang ada.
   * @returns Promise yang mengembalikan respons autentikasi dengan token baru.
   * @throws {HttpException} Jika token refresh tidak valid atau kadaluarsa.
   */
  async refreshTokens(oldRefreshToken: string): Promise<AuthResponse> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memulai pembaruan token`, {
      context: 'AuthService',
      requestId,
    });
    const tokenRecord = await this.prismaService.refreshToken.findFirst({
      where: { token: oldRefreshToken },
      include: { user: { select: this.authSelectedFields() } },
    });
    if (!tokenRecord || new Date() > tokenRecord.expiresAt) {
      this.logger.error(`Token refresh tidak valid atau kadaluarsa`, {
        context: 'AuthService',
        requestId,
      });
      throw new HttpException(
        'Token refresh tidak valid atau sudah kadaluarsa.',
        401
      );
    }

    const decryptedToken = this.decryptToken(oldRefreshToken);
    const payload = await this.verifyToken(decryptedToken, 'refresh');

    const sessionId = crypto.randomUUID();
    const newAccessToken = await this.accessJwtService.signAsync({
      id: payload.id,
      sessionId,
      role: tokenRecord.user.role,
    });
    const newRefreshToken = await this.generateRefreshToken(payload.id);

    await this.prismaService.refreshToken.delete({
      where: { id: tokenRecord.id },
    });
    await this.tokenBlacklistService.blacklistToken(
      oldRefreshToken,
      payload.id,
      tokenRecord.expiresAt
    );

    await this.logAudit(
      payload.id,
      'TOKEN_REFRESHED',
      `Pengguna ${tokenRecord.user.email} memperbarui token`
    );
    this.logger.info(
      `Token diperbarui untuk pengguna: ${tokenRecord.user.email}`,
      {
        context: 'AuthService',
        requestId,
        userId: payload.id,
      }
    );
    return this.toAuthResponse({
      id: payload.id,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      photo: tokenRecord.user.photo,
      role: tokenRecord.user.role,
    });
  }

  /**
   * Mengaktifkan autentikasi dua faktor untuk pengguna.
   * @param user - Pengguna yang sedang autentikasi.
   * @returns Promise yang mengembalikan URL kode QR untuk pengaturan 2FA.
   */
  async enable2FA(user: CurrentUserRequest): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Mengaktifkan 2FA untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    const secret = speakeasy.generateSecret({ length: 20 });
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32, twoFactorEnabled: true },
    });
    await this.logAudit(
      user.id,
      '2FA_ENABLED',
      `2FA diaktifkan untuk ${user.email}`
    );
    this.logger.info(`2FA diaktifkan untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return QRCode.toDataURL(secret.otpauth_url!);
  }

  /**
   * Memverifikasi token autentikasi dua faktor.
   * @param user - Pengguna yang sedang autentikasi.
   * @param token - Token 2FA yang akan diverifikasi.
   * @returns Promise yang mengembalikan true jika token valid, false jika tidak.
   * @throws {HttpException} Jika 2FA tidak diaktifkan atau token tidak valid.
   */
  async verify2FA(user: CurrentUserRequest, token: string): Promise<boolean> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memverifikasi token 2FA untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    const userData = await this.prismaService.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });
    if (!userData || !userData.twoFactorEnabled || !userData.twoFactorSecret) {
      this.logger.error(`2FA tidak diaktifkan untuk pengguna: ${user.email}`, {
        context: 'AuthService',
        requestId,
        userId: user.id,
      });
      throw new HttpException('2FA tidak diaktifkan untuk akun ini.', 400);
    }
    const verified = speakeasy.totp.verify({
      secret: userData.twoFactorSecret,
      encoding: 'base32',
      token,
    });
    if (!verified) {
      await this.logAudit(
        user.id,
        '2FA_VERIFY_FAILED',
        `Token 2FA tidak valid untuk ${user.email}`
      );
      this.logger.error(`Token 2FA tidak valid untuk pengguna: ${user.email}`, {
        context: 'AuthService',
        requestId,
        userId: user.id,
      });
      throw new HttpException('Token 2FA tidak valid.', 400);
    }
    await this.logAudit(
      user.id,
      '2FA_VERIFIED',
      `2FA diverifikasi untuk ${user.email}`
    );
    this.logger.info(`2FA diverifikasi untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return true;
  }

  /**
   * Membersihkan pengguna yang tidak terverifikasi lebih dari 15 menit.
   * @description Berjalan setiap menit melalui cron job.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupUnverifiedUsers(): Promise<void> {
    this.logger.debug(
      'Menjalankan pembersihan pengguna yang tidak terverifikasi',
      {
        context: 'AuthService',
      }
    );
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const unverifiedUsers = await this.prismaService.user.findMany({
      where: {
        verifiedAccount: false,
        verificationSentAt: { lte: fifteenMinutesAgo },
        accountVerificationToken: { not: null },
      },
      include: { participant: true },
    });

    for (const user of unverifiedUsers) {
      await this.prismaService.$transaction(async prisma => {
        if (user.participantId) {
          await prisma.participant.delete({
            where: { id: user.participantId },
          });
        }
        await prisma.user.delete({ where: { id: user.id } });
        await this.logAudit(
          user.id,
          'UNVERIFIED_USER_DELETED',
          `Pengguna dengan email ${user.email} dihapus karena akun tidak terverifikasi`
        );
        this.logger.info(
          `Pengguna tidak terverifikasi dihapus: ${user.email}`,
          {
            context: 'AuthService',
            userId: user.id,
          }
        );
      });
    }
  }

  /**
   * Mencadangkan data autentikasi.
   * @description Berjalan setiap 6 bulan melalui cron job.
   */
  @Cron(CronExpression.EVERY_6_MONTHS)
  async backupData(): Promise<void> {
    this.logger.debug('Menjalankan cadangan data autentikasi', {
      context: 'AuthService',
    });
    const refreshTokens = await this.prismaService.refreshToken.findMany();
    const auditLogs = await this.prismaService.auditLog.findMany();

    const backupData = {
      refreshTokens,
      auditLogs,
      timestamp: new Date().toISOString(),
    };

    const backupBuffer = Buffer.from(JSON.stringify(backupData));
    const multerBackup: Partial<Express.Multer.File> = {
      buffer: backupBuffer,
      originalname: `auth_backup_${Date.now()}.json`,
      mimetype: 'application/json',
      size: backupBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
    };

    await this.fileUploadService.uploadFile(
      multerBackup as Express.Multer.File,
      'system',
      'backups',
      true
    );

    this.logger.info('Cadangan data autentikasi selesai', {
      context: 'AuthService',
    });
  }

  /**
   * Mengambil profil pengguna saat ini.
   * @param user - Pengguna yang sedang autentikasi.
   * @returns Promise yang mengembalikan respons autentikasi dengan profil pengguna.
   * @throws {HttpException} Jika pengguna tidak ditemukan.
   */
  async profile(user: CurrentUserRequest): Promise<AuthResponse> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Mengambil profil untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    const findUser = await this.prismaService.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        ...this.authSelectedFields(),
        participant: {
          select: {
            id: true,
            idNumber: true,
            name: true,
            nik: true,
            dinas: true,
            bidang: true,
            company: true,
            email: true,
            phoneNumber: true,
            nationality: true,
            placeOfBirth: true,
            dateOfBirth: true,
            simA: { select: { path: true } },
            simB: { select: { path: true } },
            ktp: { select: { path: true } },
            foto: { select: { path: true } },
            suratSehatButaWarna: { select: { path: true } },
            suratBebasNarkoba: { select: { path: true } },
            tglKeluarSuratSehatButaWarna: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
            qrCodeLink: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!findUser) {
      this.logger.error(`Pengguna tidak ditemukan: ${user.email}`, {
        context: 'AuthService',
        requestId,
        userId: user.id,
      });
      throw new HttpException('Pengguna tidak ditemukan.', 404);
    }

    const result: Partial<AuthResponse> = {
      id: findUser.id,
      idNumber: findUser.idNumber,
      email: findUser.email,
      name: findUser.name,
      dinas: findUser.dinas,
      role: findUser.role,
      photo: findUser.photo,
      participant: findUser.participant as ParticipantResponse | null,
    };

    if (findUser.role?.name === 'user' && findUser.participant) {
      const requiredFields: (keyof ParticipantResponse)[] = [
        'name',
        'nik',
        'company',
        'email',
        'phoneNumber',
        'nationality',
        'placeOfBirth',
        'dateOfBirth',
        'simA',
        'ktp',
        'foto',
        'suratSehatButaWarna',
        'suratBebasNarkoba',
        'tglKeluarSuratSehatButaWarna',
        'tglKeluarSuratBebasNarkoba',
      ];

      result.isDataComplete = requiredFields.every(field => {
        const value = findUser.participant![field];
        return value !== null && value !== undefined;
      });
    } else {
      result.participant = null;
      result.isDataComplete = false;
    }

    this.logger.info(`Profil diambil untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return this.toAuthResponse(result);
  }

  /**
   * Mengirim ulang tautan verifikasi ke pengguna.
   * @param email - Alamat email pengguna.
   * @returns Promise yang mengembalikan pesan sukses.
   * @throws {HttpException} Jika pengguna tidak ditemukan atau sudah terverifikasi.
   */
  async resendVerificationLink(email: string): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Mengirim ulang tautan verifikasi ke: ${email}`, {
      context: 'AuthService',
      requestId,
    });
    const emailRequest = this.validationService.validate(
      AuthValidation.EMAIL,
      sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} })
    );
    const user = await this.prismaService.user.findFirst({
      where: { email: emailRequest },
      select: this.authSelectedFields(),
    });
    if (!user) {
      this.logger.error(
        `Pengguna tidak ditemukan untuk email: ${emailRequest}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      throw new HttpException('Pengguna tidak ditemukan.', 404);
    }
    if (user.verifiedAccount) {
      this.logger.error(
        `Akun sudah terverifikasi untuk email: ${emailRequest}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException('Akun Anda sudah terverifikasi.', 400);
    }

    const payload: JwtPayload = { id: user.id };
    const accountVerificationToken =
      await this.verificationJwtService.signAsync(payload);
    const verificationLink = `${this.urlHelper.getBaseUrl('backend')}/auth/verify-account/${accountVerificationToken}`;

    const sendEmail: SendEmail = {
      from: {
        name: this.configService.get<string>('APP_NAME') || 'GMF Training',
        address:
          this.configService.get<string>('MAIL_USER') ||
          'no-reply@gmftraining.com',
      },
      recipients: [{ name: user.name, address: user.email }],
      subject: 'Email Verifikasi',
      html: 'resend-verification-account',
      placeholderReplacements: { username: user.name, verificationLink },
    };

    await this.mailService.sendEmail(sendEmail);
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { accountVerificationToken, verificationSentAt: new Date() },
    });

    await this.logAudit(
      user.id,
      'RESEND_VERIFICATION',
      `Tautan verifikasi dikirim ulang ke ${user.email}`
    );
    this.logger.info(`Tautan verifikasi dikirim ulang ke: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return 'Email verifikasi sudah dikirim';
  }

  /**
   * Meminta reset kata sandi untuk pengguna.
   * @param email - Alamat email pengguna.
   * @returns Promise yang mengembalikan pesan sukses.
   */
  async passwordResetRequest(email: string): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Meminta reset kata sandi untuk: ${email}`, {
      context: 'AuthService',
      requestId,
    });
    const emailRequest = this.validationService.validate(
      AuthValidation.EMAIL,
      sanitizeHtml(email, { allowedTags: [], allowedAttributes: {} })
    );
    const user = await this.prismaService.user.findFirst({
      where: { email: emailRequest },
      select: this.authSelectedFields(),
    });

    if (!user) {
      this.logger.warn(
        `Pengguna tidak ditemukan untuk reset kata sandi: ${emailRequest}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      return 'Jika email terdaftar, tautan reset kata sandi akan dikirim.';
    }

    if (user.oauthProvider) {
      this.logger.warn(
        `Reset kata sandi tidak tersedia untuk pengguna OAuth: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException(
        'Reset kata sandi tidak tersedia untuk akun OAuth.',
        400
      );
    }

    const payload: JwtPayload = { id: user.id };
    const passwordResetToken =
      await this.verificationJwtService.signAsync(payload);
    const resetLink = `${this.urlHelper.getBaseUrl('frontend')}/reset-password/${passwordResetToken}`;

    const sendEmail: SendEmail = {
      from: {
        name: this.configService.get<string>('APP_NAME') || 'GMF Training',
        address:
          this.configService.get<string>('MAIL_USER') ||
          'no-reply@gmftraining.com',
      },
      recipients: [{ name: user.name, address: user.email }],
      subject: 'Reset Kata Sandi',
      html: 'password-reset',
      placeholderReplacements: { username: user.name, resetLink },
    };

    await this.mailService.sendEmail(sendEmail);
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { passwordResetToken },
    });

    await this.logAudit(
      user.id,
      'PASSWORD_RESET_REQUEST',
      `Tautan reset kata sandi dikirim ke ${user.email}`
    );
    this.logger.info(`Tautan reset kata sandi dikirim ke: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return 'Jika email terdaftar, tautan reset kata sandi akan dikirim.';
  }

  /**
   * Mereset kata sandi pengguna.
   * @param token - Token reset kata sandi.
   * @param newPassword - Kata sandi baru.
   * @returns Promise yang mengembalikan pesan sukses.
   * @throws {HttpException} Jika token atau pengguna tidak valid.
   */
  async resetPassword(token: string, newPassword: string): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Mereset kata sandi dengan token`, {
      context: 'AuthService',
      requestId,
    });
    const payload = await this.verifyToken(token, 'verification');
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.id },
      select: this.authSelectedFields(),
    });

    if (!user) {
      this.logger.error(`Pengguna tidak ditemukan untuk reset kata sandi`, {
        context: 'AuthService',
        requestId,
      });
      throw new HttpException('Pengguna tidak ditemukan.', 404);
    }

    if (!user.passwordResetToken || user.passwordResetToken !== token) {
      this.logger.error(
        `Token reset kata sandi tidak valid atau sudah digunakan`,
        {
          context: 'AuthService',
          requestId,
          ukiId: user.id,
        }
      );
      throw new HttpException(
        'Token reset kata sandi tidak valid atau sudah digunakan.',
        400
      );
    }

    const hashedPassword = await argon2.hash(newPassword, {
      memoryCost: this.configService.get<number>('ARGON2_MEMORY_COST', 65536),
      timeCost: this.configService.get<number>('ARGON2_TIME_COST', 3),
      parallelism: this.configService.get<number>('ARGON2_PARALLELISM', 1),
    });

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        hashAlgorithm: 'argon2',
        passwordResetToken: null,
      },
    });

    await this.logAudit(
      user.id,
      'PASSWORD_RESET',
      `Kata sandi direset untuk pengguna ${user.email}`
    );
    this.logger.info(`Kata sandi direset untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return 'Kata sandi berhasil direset.';
  }

  /**
   * Memperbarui kata sandi pengguna.
   * @param user - Pengguna yang sedang autentikasi.
   * @param updatePasswordRequest - Data permintaan pembaruan kata sandi.
   * @returns Promise yang mengembalikan pesan sukses.
   * @throws {HttpException} Jika kata sandi lama salah atau validasi gagal.
   */
  async updatePassword(
    user: CurrentUserRequest,
    updatePasswordRequest: UpdatePassword
  ): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memperbarui kata sandi untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    const validatedRequest = this.validationService.validate(
      AuthValidation.UPDATEPASSWORD,
      updatePasswordRequest
    );

    const userData = await this.prismaService.user.findUnique({
      where: { id: user.id },
      select: { password: true, hashAlgorithm: true },
    });

    if (!userData || !userData.password) {
      this.logger.error(
        `Kata sandi tidak tersedia untuk pengguna: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException('Kata sandi tidak tersedia untuk akun ini.', 400);
    }

    if (!validatedRequest.oldPassword) {
      this.logger.error(
        `Kata sandi lama diperlukan untuk pengguna: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new BadRequestException('Kata sandi lama diperlukan.');
    }

    const isOldPasswordValid = await this.verifyPassword(
      { password: userData.password, hashAlgorithm: userData.hashAlgorithm },
      validatedRequest.oldPassword
    );

    if (!isOldPasswordValid) {
      this.logger.error(
        `Kata sandi lama tidak valid untuk pengguna: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException('Kata sandi lama tidak valid.', 400);
    }

    const hashedPassword = await argon2.hash(validatedRequest.newPassword, {
      memoryCost: this.configService.get<number>('ARGON2_MEMORY_COST', 65536),
      timeCost: this.configService.get<number>('ARGON2_TIME_COST', 3),
      parallelism: this.configService.get<number>('ARGON2_PARALLELISM', 1),
    });

    await this.prismaService.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        hashAlgorithm: 'argon2',
      },
    });

    await this.logAudit(
      user.id,
      'PASSWORD_UPDATED',
      `Kata sandi diperbarui untuk pengguna ${user.email}`
    );
    this.logger.info(`Kata sandi diperbarui untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return 'Kata sandi berhasil diperbarui.';
  }

  /**
   * Menangani logout pengguna dari sesi saat ini.
   * @param user - Pengguna yang sedang autentikasi.
   * @param refreshToken - Token refresh yang akan dihapus.
   * @returns Promise yang mengembalikan pesan sukses.
   * @throws {HttpException} Jika token refresh tidak valid.
   */
  async logout(
    user: CurrentUserRequest,
    refreshToken: string
  ): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memulai logout untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    const tokenRecord = await this.prismaService.refreshToken.findFirst({
      where: { token: refreshToken, userId: user.id },
    });

    if (!tokenRecord) {
      this.logger.warn(
        `Token refresh tidak ditemukan untuk pengguna: ${user.email}`,
        {
          context: 'AuthService',
          requestId,
          userId: user.id,
        }
      );
      throw new HttpException('Token refresh tidak valid.', 400);
    }

    await this.prismaService.refreshToken.delete({
      where: { id: tokenRecord.id },
    });
    await this.tokenBlacklistService.blacklistToken(
      refreshToken,
      user.id,
      tokenRecord.expiresAt
    );

    await this.logAudit(user.id, 'LOGOUT', `Pengguna ${user.email} logout`);
    this.logger.info(`Logout berhasil untuk pengguna: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return 'Logout berhasil.';
  }

  /**
   * Menangani logout pengguna dari semua perangkat.
   * @param user - Pengguna yang sedang autentikasi.
   * @returns Promise yang mengembalikan pesan sukses.
   */
  async logoutAllDevices(user: CurrentUserRequest): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(
      `Memulai logout semua perangkat untuk pengguna: ${user.email}`,
      {
        context: 'AuthService',
        requestId,
        userId: user.id,
      }
    );
    const refreshTokens = await this.prismaService.refreshToken.findMany({
      where: { userId: user.id },
    });

    await this.prismaService.$transaction(async prisma => {
      for (const token of refreshTokens) {
        await prisma.blacklistedToken.create({
          data: {
            token: token.token,
            userId: user.id,
            expiresAt: token.expiresAt,
          },
        });
      }
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      });
    });

    await this.logAudit(
      user.id,
      'LOGOUT_ALL_DEVICES',
      `Pengguna ${user.email} logout dari semua perangkat`
    );
    this.logger.info(
      `Logout semua perangkat berhasil untuk pengguna: ${user.email}`,
      {
        context: 'AuthService',
        requestId,
        userId: user.id,
      }
    );
    return 'Berhasil logout dari semua perangkat.';
  }
}
