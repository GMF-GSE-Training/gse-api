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
import { firstValueFrom, map } from 'rxjs';
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
  OAuthProvider,
} from '../model/auth.model.js';
import { ParticipantResponse } from '../model/participant.model.js';

import { AuthValidation, AuthResponseSchema } from './auth.validation.js';
import {
  ACCESS_JWT_SERVICE,
  REFRESH_JWT_SERVICE,
  VERIFICATION_JWT_SERVICE,
} from './jwt/jwt.constants.js';
import { CustomJwtService } from './jwt/jwt.service.js';

// Define the type for the Prisma user object including all selected relations
type AuthSelectedFieldsUser = Prisma.UserGetPayload<{
  select: {
    id: true;
    email: true;
    name: true;
    idNumber: true;
    nik: true;
    dinas: true;
    password: true;
    photo: true;
    hashAlgorithm: true;
    verifiedAccount: true;
    accountVerificationToken: true;
    verificationSentAt: true;
    passwordResetToken: true;
    updateEmailToken: true;
    loginAttempts: true;
    lockUntil: true;
    twoFactorEnabled: true;
    twoFactorSecret: true;
    oauthProvider: true;
    oauthId: true;
    oauthRefreshToken: true;
    createdAt: true;
    updatedAt: true;
    role: { select: { id: true; name: true } };
    participantId: true;
    participant: {
      select: {
        id: true;
        idNumber: true;
        name: true;
        nik: true;
        dinas: true;
        bidang: true;
        company: true;
        email: true;
        phoneNumber: true;
        nationality: true;
        placeOfBirth: true;
        dateOfBirth: true;
        qrCodeLink: true;
        tglKeluarSuratSehatButaWarna: true;
        tglKeluarSuratBebasNarkoba: true;
        gmfNonGmf: true;
        createdAt: true;
        updatedAt: true;
        simA: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
        simB: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
        ktp: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
        foto: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
        suratSehatButaWarna: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
        suratBebasNarkoba: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
        qrCode: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
        idCard: {
          select: {
            id: true;
            path: true;
            fileName: true;
            mimeType: true;
            fileSize: true;
            isSensitive: true;
            iv: true;
            storageType: true;
            createdAt: true;
          };
        };
      };
    };
  };
}>;

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
   * Mendekripsi token AES-256-CBC.
   * @param encryptedToken - Token terenkripsi dalam format hex (IV:encrypted).
   * @returns Token yang sudah didekripsi.
   * @throws {UnauthorizedException} Jika dekripsi gagal (misalnya, token tidak valid).
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const textParts = encryptedToken.split(':');
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const key = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch (error) {
      this.logger.error(
        `Gagal mendekripsi token: ${(error as Error).message}`,
        {
          context: 'AuthService',
        }
      );
      throw new UnauthorizedException('Token tidak valid.');
    }
  }

  /**
   * Memverifikasi dan mendekripsi token JWT.
   * @param token - Token JWT yang akan diverifikasi.
   * @param type - Tipe token (access, refresh, verification).
   * @returns Promise yang mengembalikan payload JWT jika valid.
   * @throws {UnauthorizedException} Jika token tidak valid atau kadaluarsa.
   */
  private async verifyToken(
    token: string,
    type: 'access' | 'refresh' | 'verification'
  ): Promise<JwtPayload> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Memverifikasi ${type} token`, {
      context: 'AuthService',
      requestId,
    });

    try {
      const jwtService =
        type === 'access'
          ? this.accessJwtService
          : type === 'refresh'
            ? this.refreshJwtService
            : this.verificationJwtService;
      const payload = await jwtService.verifyAsync(token);

      if (type === 'refresh' || type === 'access') {
        const isBlacklisted =
          await this.tokenBlacklistService.isTokenBlacklisted(token);
        if (isBlacklisted) {
          this.logger.warn(`${type} token ada di daftar hitam`, {
            context: 'AuthService',
            requestId,
          });
          throw new UnauthorizedException('Token tidak valid.');
        }
      }

      this.logger.info(`${type} token berhasil diverifikasi`, {
        context: 'AuthService',
        requestId,
        userId: payload.id,
      });

      return payload;
    } catch (error) {
      this.logger.error(
        `Gagal memverifikasi ${type} token: ${(error as Error).message}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      throw new UnauthorizedException('Token tidak valid atau kadaluarsa.');
    }
  }

  /**
   * Mencatat aktivitas audit.
   * @param userId - ID pengguna yang melakukan aktivitas.
   * @param action - Deskripsi tindakan yang dilakukan.
   * @param details - Detail tambahan tentang aktivitas.
   * @returns Promise yang mengembalikan void setelah mencatat audit.
   */
  private async logAudit(
    userId: string | null,
    action: string,
    details?: string
  ): Promise<void> {
    await this.prismaService.auditLog.create({
      data: {
        userId,
        action,
        details,
      },
    });
  }

  /**
   * Memverifikasi token CAPTCHA.
   * @param token - Token reCAPTCHA yang akan diverifikasi.
   * @returns Promise yang mengembalikan true jika CAPTCHA valid, false jika tidak.
   */
  async verifyCaptcha(token: string): Promise<boolean> {
    const requestId = crypto.randomUUID();
    this.logger.debug('Memverifikasi CAPTCHA', {
      context: 'AuthService',
      requestId,
    });

    const secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('RECAPTCHA_SECRET_KEY tidak dikonfigurasi', {
        context: 'AuthService',
        requestId,
      });
      // return true; // Untuk pengembangan, agar tidak perlu reCAPTCHA
      throw new BadRequestException('CAPTCHA tidak dikonfigurasi.');
    }

    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
    try {
      const data = await firstValueFrom<RecaptchaResponse['data']>(
        this.httpService.post(url).pipe(map(response => response.data))
      );

      if (!data.success) {
        this.logger.warn('Verifikasi CAPTCHA gagal', {
          context: 'AuthService',
          requestId,
          errors: data.error_codes,
        });
        throw new BadRequestException('Verifikasi CAPTCHA gagal.');
      }

      if (data.score && data.score < 0.5) {
        this.logger.warn('Skor CAPTCHA rendah', {
          context: 'AuthService',
          requestId,
          score: data.score,
        });
        return false;
      }

      this.logger.info('Verifikasi CAPTCHA berhasil', {
        context: 'AuthService',
        requestId,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Error saat verifikasi CAPTCHA: ${(error as Error).message}`,
        {
          context: 'AuthService',
          requestId,
        }
      );
      throw new BadRequestException('Verifikasi CAPTCHA gagal.');
    }
  }

  /**
   * Memeriksa apakah pengguna dengan ID number atau email yang diberikan sudah ada.
   * @param idNumber - ID number pengguna.
   * @param email - Email pengguna.
   * @returns Promise yang mengembalikan void.
   * @throws {HttpException} Jika pengguna sudah ada.
   */
  private async checkUserExists(
    idNumber?: string,
    email?: string
  ): Promise<void> {
    const where: Prisma.UserWhereInput = {};
    if (idNumber) {
      where.idNumber = idNumber;
    }
    if (email) {
      where.email = email;
    }

    const existingUser = await this.prismaService.user.findFirst({
      where,
    });

    if (existingUser) {
      if (idNumber && existingUser.idNumber === idNumber) {
        throw new HttpException('Nomor pegawai sudah digunakan.', 400);
      }
      if (email && existingUser.email === email) {
        throw new HttpException('Email sudah digunakan.', 400);
      }
    }
  }

  /**
   * Menghasilkan refresh token baru untuk pengguna.
   * @param userId - ID pengguna.
   * @returns Promise yang mengembalikan refresh token baru.
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    const requestId = crypto.randomUUID();
    this.logger.debug(`Menghasilkan refresh token untuk pengguna: ${userId}`, {
      context: 'AuthService',
      requestId,
    });

    const existingToken = await this.prismaService.refreshToken.findFirst({
      where: { userId },
    });

    const payload: JwtPayload = { id: userId };
    const refreshToken = await this.refreshJwtService.signAsync(payload);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Token berlaku 7 hari

    if (existingToken) {
      await this.prismaService.refreshToken.update({
        where: { id: existingToken.id },
        data: { token: refreshToken, expiresAt },
      });
      this.logger.info(`Refresh token diperbarui untuk pengguna: ${userId}`, {
        context: 'AuthService',
        requestId,
      });
    } else {
      await this.prismaService.refreshToken.create({
        data: { userId, token: refreshToken, expiresAt },
      });
      this.logger.info(`Refresh token dibuat untuk pengguna: ${userId}`, {
        context: 'AuthService',
        requestId,
      });
    }
    return refreshToken;
  }

  /**
   * Mengonversi objek User dari Prisma menjadi AuthResponse.
   * @param user - Objek User dari Prisma.
   * @returns Objek AuthResponse yang sudah terformat.
   */
  private toAuthResponse(user: AuthSelectedFieldsUser): AuthResponse {
    const participantData: ParticipantResponse | null = user.participant
      ? {
          id: user.participant.id,
          idNumber: user.participant.idNumber,
          name: user.participant.name,
          nik: user.participant.nik,
          email: user.participant.email,
          dinas: user.participant.dinas,
          bidang: user.participant.bidang,
          company: user.participant.company,
          phoneNumber: user.participant.phoneNumber,
          nationality: user.participant.nationality,
          placeOfBirth: user.participant.placeOfBirth,
          dateOfBirth: user.participant.dateOfBirth?.toISOString() || null,
          tglKeluarSuratSehatButaWarna:
            user.participant.tglKeluarSuratSehatButaWarna?.toISOString() ||
            null,
          tglKeluarSuratBebasNarkoba:
            user.participant.tglKeluarSuratBebasNarkoba?.toISOString() || null,
          gmfNonGmf: user.participant.gmfNonGmf,
          qrCodeLink: user.participant.qrCodeLink,
          createdAt: user.participant.createdAt.toISOString(),
          updatedAt: user.participant.updatedAt.toISOString(),
          fotoUrl:
            user.participant.foto && 'path' in user.participant.foto
              ? (user.participant.foto.path as string)
              : null,
          ktpUrl:
            user.participant.ktp && 'path' in user.participant.ktp
              ? (user.participant.ktp.path as string)
              : null,
          simAUrl:
            user.participant.simA && 'path' in user.participant.simA
              ? (user.participant.simA.path as string)
              : null,
          simBUrl:
            user.participant.simB && 'path' in user.participant.simB
              ? (user.participant.simB.path as string)
              : null,
          suratSehatButaWarnaUrl:
            user.participant.suratSehatButaWarna &&
            'path' in user.participant.suratSehatButaWarna
              ? (user.participant.suratSehatButaWarna.path as string)
              : null,
          suratBebasNarkobaUrl:
            user.participant.suratBebasNarkoba &&
            'path' in user.participant.suratBebasNarkoba
              ? (user.participant.suratBebasNarkoba.path as string)
              : null,
          qrCodeUrl:
            user.participant.qrCode && 'path' in user.participant.qrCode
              ? (user.participant.qrCode.path as string)
              : null,
        }
      : null;

    return {
      id: user.id,
      idNumber: user.idNumber,
      email: user.email,
      name: user.name,
      dinas: user.dinas,
      photo: user.photo,
      role: user.role,
      participant: participantData,
    };
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
          select: {
            id: true,
            email: true,
            name: true,
            idNumber: true,
            nik: true,
            dinas: true,
            password: true,
            photo: true,
            hashAlgorithm: true,
            verifiedAccount: true,
            accountVerificationToken: true,
            verificationSentAt: true,
            passwordResetToken: true,
            updateEmailToken: true,
            loginAttempts: true,
            lockUntil: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            oauthProvider: true,
            oauthId: true,
            oauthRefreshToken: true,
            createdAt: true,
            updatedAt: true,
            role: { select: { id: true, name: true } },
            participantId: true,
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
                qrCodeLink: true,
                tglKeluarSuratSehatButaWarna: true,
                tglKeluarSuratBebasNarkoba: true,
                gmfNonGmf: true,
                createdAt: true,
                updatedAt: true,
                simA: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
                simB: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
                ktp: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
                foto: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
                suratSehatButaWarna: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
                suratBebasNarkoba: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
                qrCode: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
                idCard: {
                  select: {
                    id: true,
                    path: true,
                    fileName: true,
                    mimeType: true,
                    fileSize: true,
                    isSensitive: true,
                    iv: true,
                    storageType: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
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
          originalname: 'qr_code.png',
          mimetype: 'image/png',
          size: qrCodeBuffer.length,
          fieldname: 'file',
          encoding: '7bit',
        };

        const { fileId: qrCodeFileId, path: qrCodePath } =
          await this.fileUploadService.uploadFile(
            multerQrCode as Express.Multer.File,
            participant.id,
            'qrcodes',
            false
          );

        const qrCode = await this.prismaService.fileMetadata.create({
          data: {
            fileName: 'qr_code.png',
            mimeType: 'image/png',
            fileSize: qrCodeBuffer.byteLength,
            path: qrCodePath,
            storageType: 'local',
            isSensitive: false,
            participantQrCode: {
              connect: { id: participant.id },
            },
          },
        });

        await prisma.participant.update({
          where: { id: participant.id },
          data: {
            qrCodeLink: qrCodeLink,
          },
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
      subject: 'Verifikasi Akun GMF Training',
      html: 'verify-account',
      placeholderReplacements: { username: user.name, verificationLink },
    };

    await this.mailService.sendEmail(email);
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { accountVerificationToken, verificationSentAt: new Date() },
    });

    this.logger.info(`Tautan verifikasi ulang dikirim ke: ${user.email}`, {
      context: 'AuthService',
      requestId,
      userId: user.id,
    });
    return 'Tautan verifikasi ulang berhasil dikirim.';
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

    const user = await this.prismaService.user.findFirst({
      where: { oauthId: String(oauthId), oauthProvider: provider },
      select: {
        id: true,
        email: true,
        name: true,
        idNumber: true,
        nik: true,
        dinas: true,
        password: true,
        photo: true,
        hashAlgorithm: true,
        verifiedAccount: true,
        accountVerificationToken: true,
        verificationSentAt: true,
        passwordResetToken: true,
        updateEmailToken: true,
        loginAttempts: true,
        lockUntil: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        oauthProvider: true,
        oauthId: true,
        oauthRefreshToken: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
        participantId: true,
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
            qrCodeLink: true,
            tglKeluarSuratSehatButaWarna: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
            createdAt: true,
            updatedAt: true,
            simA: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            simB: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            ktp: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            foto: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratSehatButaWarna: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratBebasNarkoba: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            qrCode: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            idCard: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      this.logger.error(`Pengguna tidak ditemukan: ${email}`, {
        context: 'AuthService',
        requestId,
      });
      throw new HttpException('Pengguna tidak ditemukan.', 404);
    }

    const result: Partial<AuthResponse> = {
      id: user.id,
      idNumber: user.idNumber,
      email: user.email,
      name: user.name,
      dinas: user.dinas,
      role: user.role,
      photo: user.photo,
      participant: user.participant as ParticipantResponse | null,
    };

    if (user.role?.name === 'user' && user.participant) {
      const requiredFields: (keyof ParticipantResponse)[] = [
        'name',
        'nik',
        'company',
        'email',
        'phoneNumber',
        'nationality',
        'placeOfBirth',
        'dateOfBirth',
        'simAUrl',
        'ktpUrl',
        'fotoUrl',
        'suratSehatButaWarnaUrl',
        'suratBebasNarkobaUrl',
        'tglKeluarSuratSehatButaWarna',
        'tglKeluarSuratBebasNarkoba',
      ];

      result.isDataComplete = requiredFields.every(field => {
        const value = (user.participant as any)[field];
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
    return this.toAuthResponse(user);
  }

  /**
   * Verifikasi password dengan hash yang sesuai (argon2/bcrypt).
   * @param user - Objek user yang berisi password dan hashAlgorithm.
   * @param password - Password yang ingin diverifikasi.
   * @returns Promise<boolean> true jika password valid.
   */
  private async verifyPassword(
    user: UserForPasswordVerification,
    password: string
  ): Promise<boolean> {
    if (!user.password) return false;
    if (user.hashAlgorithm === 'bcrypt') {
      return bcrypt.compare(password, user.password);
    }
    // Default argon2
    return argon2.verify(user.password, password);
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
      select: {
        id: true,
        email: true,
        name: true,
        idNumber: true,
        nik: true,
        dinas: true,
        password: true,
        photo: true,
        hashAlgorithm: true,
        verifiedAccount: true,
        accountVerificationToken: true,
        verificationSentAt: true,
        passwordResetToken: true,
        updateEmailToken: true,
        loginAttempts: true,
        lockUntil: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        oauthProvider: true,
        oauthId: true,
        oauthRefreshToken: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
        participantId: true,
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
            qrCodeLink: true,
            tglKeluarSuratSehatButaWarna: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
            createdAt: true,
            updatedAt: true,
            simA: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            simB: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            ktp: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            foto: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratSehatButaWarna: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratBebasNarkoba: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            qrCode: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            idCard: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
          },
        },
      },
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
      select: {
        id: true,
        email: true,
        name: true,
        idNumber: true,
        nik: true,
        dinas: true,
        password: true,
        photo: true,
        hashAlgorithm: true,
        verifiedAccount: true,
        accountVerificationToken: true,
        verificationSentAt: true,
        passwordResetToken: true,
        updateEmailToken: true,
        loginAttempts: true,
        lockUntil: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        oauthProvider: true,
        oauthId: true,
        oauthRefreshToken: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
        participantId: true,
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
            qrCodeLink: true,
            tglKeluarSuratSehatButaWarna: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
            createdAt: true,
            updatedAt: true,
            simA: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            simB: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            ktp: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            foto: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratSehatButaWarna: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratBebasNarkoba: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            qrCode: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            idCard: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
          },
        },
      },
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
      subject: 'Reset Kata Sandi GMF Training',
      html: 'reset-password',
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
    const user = await this.prismaService.user.findFirst({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        idNumber: true,
        nik: true,
        dinas: true,
        password: true,
        photo: true,
        hashAlgorithm: true,
        verifiedAccount: true,
        accountVerificationToken: true,
        verificationSentAt: true,
        passwordResetToken: true,
        updateEmailToken: true,
        loginAttempts: true,
        lockUntil: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        oauthProvider: true,
        oauthId: true,
        oauthRefreshToken: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
        participantId: true,
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
            qrCodeLink: true,
            tglKeluarSuratSehatButaWarna: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
            createdAt: true,
            updatedAt: true,
            simA: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            simB: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            ktp: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            foto: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratSehatButaWarna: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratBebasNarkoba: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            qrCode: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            idCard: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
          },
        },
      },
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
   * @param user - Pengguna yang sedang terautentikasi.
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
   * @param user - Pengguna yang sedang terautentikasi.
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
   * @param user - Pengguna yang sedang terautentikasi.
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

  async updateEmailRequest(
    user: CurrentUserRequest,
    email: string
  ): Promise<string> {
    // TODO: Implementasi logika permintaan perubahan email
    return Promise.resolve('Permintaan perubahan email dikirim');
  }

  async verifyUpdateEmailRequestToken(
    user: CurrentUserRequest,
    token: string
  ): Promise<any> {
    // TODO: Implementasi logika verifikasi token perubahan email
    return Promise.resolve('Email berhasil diperbarui');
  }

  async verifyPasswordResetRequestToken(token: string): Promise<any> {
    // TODO: Implementasi logika verifikasi token reset password
    return Promise.resolve('Token valid');
  }

  async loginUser(req: LoginUserRequest): Promise<AuthResponse> {
    const requestId = crypto.randomUUID();
    // Trim whitespace dari identifier
    const cleanIdentifier = req.identifier.trim();
    this.logger.debug(`Memulai login pengguna: ${cleanIdentifier}`, {
      context: 'AuthService',
      requestId,
    });
    const user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ email: cleanIdentifier }, { idNumber: cleanIdentifier }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        idNumber: true,
        nik: true,
        dinas: true,
        password: true,
        photo: true,
        hashAlgorithm: true,
        verifiedAccount: true,
        accountVerificationToken: true,
        verificationSentAt: true,
        passwordResetToken: true,
        updateEmailToken: true,
        loginAttempts: true,
        lockUntil: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        oauthProvider: true,
        oauthId: true,
        oauthRefreshToken: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true } },
        participantId: true,
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
            qrCodeLink: true,
            tglKeluarSuratSehatButaWarna: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
            createdAt: true,
            updatedAt: true,
            simA: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            simB: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            ktp: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            foto: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratSehatButaWarna: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            suratBebasNarkoba: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            qrCode: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
            idCard: {
              select: {
                id: true,
                path: true,
                fileName: true,
                mimeType: true,
                fileSize: true,
                isSensitive: true,
                iv: true,
                storageType: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Email/ID atau password salah.');
    }
    // Cek apakah akun terkunci
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new UnauthorizedException(
        'Akun Anda terkunci sementara karena terlalu banyak percobaan login gagal. Silakan coba lagi nanti.'
      );
    }
    // Verifikasi password
    const isPasswordValid = await this.verifyPassword(
      { password: user.password, hashAlgorithm: user.hashAlgorithm },
      req.password
    );
    if (!isPasswordValid) {
      // Increment loginAttempts
      let loginAttempts = user.loginAttempts ?? 0;
      loginAttempts++;
      let lockUntil = user.lockUntil;
      if (loginAttempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Kunci 15 menit
      }
      await this.prismaService.user.update({
        where: { id: user.id },
        data: { loginAttempts, lockUntil },
      });
      throw new UnauthorizedException('Email/ID atau password salah.');
    }
    // Reset loginAttempts jika sukses
    if (user.loginAttempts > 0 || user.lockUntil) {
      await this.prismaService.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockUntil: null },
      });
    }
    // Lanjutkan proses login (generate token dsb)
    // ...
    return this.toAuthResponse(user as AuthSelectedFieldsUser);
  }

  async accountVerification(token: string): Promise<string> {
    return 'Account verified';
  }

  async login(
    request: any
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return {
      accessToken: 'dummyAccessToken',
      refreshToken: 'dummyRefreshToken',
    };
  }

  async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return {
      accessToken: 'dummyAccessToken',
      refreshToken: 'dummyRefreshToken',
    };
  }

  async profile(
    user: any
  ): Promise<{ id: string; email: string; name: string; role: any }> {
    return {
      id: '1',
      email: 'user@example.com',
      name: 'User',
      role: { id: '1', name: 'user' },
    };
  }
}
