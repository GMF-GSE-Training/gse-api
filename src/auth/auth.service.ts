import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import { AuthValidation } from './auth.validation';
import {
  AuthResponse,
  LoginUserRequest,
  RegisterUserRequest,
  UpdatePassword,
  CurrentUserRequest,
} from '../model/auth.model';
import { SendEmail } from '../model/mail.model';
import { JwtService } from '@nestjs/jwt';
import { CoreHelper } from 'src/common/helpers/core.helper';
import { UrlHelper } from 'src/common/helpers/url.helper';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @Inject('ACCESS_JWT_SERVICE') private accessJwtService: JwtService,
    @Inject('REFRESH_JWT_SERVICE') private refreshJwtService: JwtService,
    @Inject('VERIFICATION_JWT_SERVICE')
    private verificationJwtService: JwtService,
    private coreHelper: CoreHelper,
    private urlHelper: UrlHelper
  ) {}

  async register(req: RegisterUserRequest): Promise<string> {
    this.logger.debug('Memulai registrasi pengguna');

    if (req.roleId) {
      this.logger.warn('Percobaan menentukan role oleh pengguna');
      throw new HttpException('Anda tidak berhak menentukan role', 403);
    }

    const defaultRole = await this.prismaService.role.findFirst({
      where: { name: { equals: 'user', mode: 'insensitive' } },
    });

    if (!defaultRole) {
      this.logger.error('Role default "user" tidak ditemukan');
      throw new HttpException('Role tidak ditemukan', 404);
    }

    req.roleId = defaultRole.id;
    const registerRequest: RegisterUserRequest = this.validationService.validate(
      AuthValidation.REGISTER,
      req,
    );

    const participant = await this.prismaService.participant.findUnique({
      where: { nik: req.nik },
    });

    if (participant) {
      if (registerRequest.email !== participant.email) {
        throw new HttpException('Email tidak sesuai dengan data peserta', 400);
      }
      if (
        participant.idNumber &&
        registerRequest.idNumber !== participant.idNumber
      ) {
        throw new HttpException(
          'No Pegawai tidak sesuai dengan data peserta',
          400,
        );
      }
      if (participant.dinas && registerRequest.dinas !== participant.dinas) {
        throw new HttpException('Dinas tidak sesuai dengan data peserta', 400);
      }
      req.participantId = participant.id;
    }

    await this.checkUserExists(registerRequest.idNumber, registerRequest.email);
    registerRequest.password = await bcrypt.hash(registerRequest.password, 10);

    const authSelectedFields = this.authSelectedFields();

    let accountVerificationToken = '';

    const [user, newParticipant] = await this.prismaService.$transaction(
      async (prisma) => {
        try {
          await this.coreHelper.ensureUniqueFields(
            'participant',
            [
              {
                field: 'idNumber',
                value: registerRequest.idNumber,
                message: 'No Pegawai sudah digunakan',
              },
              {
                field: 'nik',
                value: registerRequest.nik,
                message: 'NIK sudah digunakan',
              },
              {
                field: 'email',
                value: registerRequest.email,
                message: 'Email sudah digunakan',
              },
            ],
            undefined,
            prisma,
          );

          const user = await prisma.user.create({
            data: registerRequest,
            select: authSelectedFields,
          });

          const createParticipantData = {
            idNumber: registerRequest.idNumber,
            name: registerRequest.name,
            nik: registerRequest.nik,
            email: registerRequest.email,
            dinas: registerRequest.dinas,
          };

          const participant = await prisma.participant.create({
            data: createParticipantData,
          });

          const payload = { id: user.id };
          accountVerificationToken =
            await this.verificationJwtService.signAsync(payload);
          this.logger.debug(
            `Register: Token verifikasi baru dibuat untuk user ${
              user.id
            }: ${accountVerificationToken.substring(0, 20)}...`,
          );
          await prisma.user.update({
            where: { id: user.id },
            data: { accountVerificationToken },
          });
          const updatedUserAfterToken = await prisma.user.findUnique({
            where: { id: user.id },
            select: { accountVerificationToken: true },
          });
          this.logger.debug(
            `Register: Token verifikasi yang disimpan di DB untuk user ${
              user.id
            }: ${updatedUserAfterToken?.accountVerificationToken?.substring(
              0,
              20,
            )}...`,
          );

          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { participantId: participant.id },
          });

          return [updatedUser, participant];
        } catch (error) {
          this.logger.error('Gagal dalam transaksi registrasi', error.stack);
          throw error;
        }
      },
      { timeout: 10000 },
    );

    const link = this.urlHelper.getBaseUrl('backend');
    const verificationLink = `${link}/auth/verify-account/${accountVerificationToken}`;

    const email: SendEmail = {
      from: {
        name: this.configService.get<string>('APP_NAME'),
        address: this.configService.get<string>('MAIL_USER'),
      },
      receptients: [{ name: user.name, address: user.email }],
      subject: 'Email Verifikasi',
      html: 'verify-account',
      placeholderReplacements: {
        username: user.name,
        verificationLink: verificationLink,
      },
    };

    try {
      await this.mailService.sendEmail(email);
      this.logger.log('Email verifikasi berhasil dikirim ke: ' + user.email);
    } catch (emailError) {
      this.logger.error('Error sending verification email:', emailError);
      throw new HttpException(
        'Gagal mengirim email verifikasi. Silakan coba lagi nanti atau verifikasi secara manual.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.debug('Registrasi berhasil untuk pengguna: ' + user.email);
    return 'Registrasi berhasil';
  }

  async accountVerification(token: string): Promise<AuthResponse> {
    this.logger.debug(
      `Verifikasi Akun: Token diterima di service: ${
        token ? token.substring(0, 20) + '...' : 'null/undefined/empty'
      }`,
    );

    try {
      const verifyToken = await this.verificationJwtService.verifyAsync(token);
      this.logger.debug(
        `Verifikasi Akun: Token JWT berhasil diverifikasi. Payload: ${JSON.stringify(
          verifyToken,
        )}`,
      );

      const user = await this.prismaService.user.findUnique({
        where: {
          id: verifyToken.id,
        },
        include: { role: true },
      });

      if (!user) {
        throw new HttpException('Pengguna tidak ditemukan', 404);
      }

      const trimmedToken = token.trim();
      const trimmedDbToken = user.accountVerificationToken?.trim();

      if (!trimmedDbToken || trimmedDbToken !== trimmedToken) {
        this.logger.warn(
          `Verifikasi Akun: Token dari URL tidak cocok dengan token di DB untuk user ${user.id}`,
        );
        throw new HttpException(
          'Token ini tidak valid atau sudah digunakan',
          400,
        );
      }

      const payload = { id: user.id };
      const refreshToken = await this.refreshJwtService.signAsync(payload);
      const accessToken = await this.accessJwtService.signAsync(payload);

      await this.prismaService.user.update({
        where: {
          id: user.id,
        },
        data: {
          refreshToken: refreshToken,
          accountVerificationToken: null,
          verifiedAccount: true,
        },
        include: { role: true },
      });
      this.logger.debug(
        `Verifikasi Akun: Akun ${user.id} berhasil diverifikasi. Token verifikasi dihapus, status verifikasi diatur ke true.`,
      );

      return this.toAuthResponse(user, accessToken, refreshToken);
    } catch (error) {
      this.logger.error(
        `Verifikasi Akun: Gagal memverifikasi token. Error: ${error.message}. Stack: ${error.stack}`,
      );
      throw new HttpException('Token tidak valid atau telah kadaluarsa', 400);
    }
  }

  async login(req: LoginUserRequest): Promise<AuthResponse> {
    const loginRequest: LoginUserRequest = this.validationService.validate(
      AuthValidation.LOGIN,
      req,
    );

    let user: User | null;
    if (loginRequest.identifier.includes('@')) {
      user = await this.prismaService.user.findFirst({
        where: {
          email: loginRequest.identifier,
        },
        include: { role: true },
      });
    } else {
      user = await this.prismaService.user.findFirst({
        where: {
          idNumber: loginRequest.identifier,
        },
        include: { role: true },
      });
    }

    if (!user) {
      throw new HttpException(
        'Akun Anda belum terdaftar. Silakan lakukan pendaftaran.',
        HttpStatus.NOT_FOUND,
      );
    }

    const role = await this.prismaService.role.findUnique({
      where: { id: user.roleId },
    });
    if (role?.name.toLowerCase() === 'user' && !user.verifiedAccount) {
      throw new HttpException('ACCOUNT_NOT_VERIFIED', 403);
    }

    const isPasswordValid = await bcrypt.compare(
      loginRequest.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new HttpException(
        'Kata sandi yang Anda masukkan salah.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const payload = { id: user.id };

    try {
      const accessToken = await this.accessJwtService.signAsync(payload);
      const refreshToken = await this.refreshJwtService.signAsync(payload);
      user = await this.prismaService.user.update({
        where: {
          id: user.id,
        },
        data: {
          refreshToken: refreshToken,
        },
        include: { role: true },
      });

      return this.toAuthResponse(user, accessToken, refreshToken);
    } catch (error) {
      console.log(error);
      throw new HttpException('Failed to generate token', 500);
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      const verifyRefreshToken =
        await this.refreshJwtService.verifyAsync(refreshToken);

      const user = await this.prismaService.user.findUnique({
        where: { id: verifyRefreshToken.id },
        include: { role: true },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new HttpException('Unauthorized', 401);
      }

      const payload = { id: user.id };
      const newAccessToken = await this.accessJwtService.signAsync(payload);

      return this.toAuthResponse(user, newAccessToken, refreshToken);
    } catch (error) {
      console.log(error);
      throw new HttpException('Unauthorized', 401);
    }
  }

  async profile(user: CurrentUserRequest): Promise<AuthResponse> {
    const findUser = await this.prismaService.user.findUnique({
      where: {
        id: user.id,
      },
      include: {
        role: true,
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
            simAFileName: true,
            simBFileName: true,
            ktpFileName: true,
            fotoFileName: true,
            suratSehatButaWarnaFileName: true,
            suratBebasNarkobaFileName: true,
            tglKeluarSuratSehatButaWarna: true,
            tglKeluarSuratBebasNarkoba: true,
            gmfNonGmf: true,
          },
        },
      },
    });

    if (!findUser) {
      throw new HttpException('User tidak ditemukan', 404);
    }

    const authResponse: AuthResponse = {
      id: findUser.id,
      email: findUser.email || undefined,
      name: findUser.name || undefined,
      idNumber: findUser.idNumber || undefined,
      dinas: findUser.dinas || undefined,
      roleId: findUser.roleId || undefined,
      verifiedAccount: findUser.verifiedAccount || undefined,
      role: findUser.role
        ? { id: findUser.role.id, name: findUser.role.name }
        : undefined,
      participant: findUser.participant || undefined,
      accessToken: await this.accessJwtService.signAsync({ id: findUser.id }),
      refreshToken: findUser.refreshToken || undefined,
    };

    if (findUser.role.name === 'user' && findUser.participant) {
      const requiredFields = [
        'name',
        'nik',
        'company',
        'email',
        'phoneNumber',
        'nationality',
        'placeOfBirth',
        'dateOfBirth',
        'simAFileName',
        'ktpFileName',
        'fotoFileName',
        'suratSehatButaWarnaFileName',
        'tglKeluarSuratSehatButaWarna',
        'suratBebasNarkobaFileName',
        'tglKeluarSuratBebasNarkoba',
      ];

      const isComplete = requiredFields.every(
        (field) =>
          findUser.participant[field] !== null &&
          findUser.participant[field] !== undefined,
      );
      authResponse.isDataComplete = isComplete;
    }

    return authResponse;
  }

  async resendVerificationLink(email: string): Promise<string> {
    this.logger.debug(
      `Memulai pengiriman ulang tautan verifikasi untuk email: ${email}`,
    );

    const emailRequest = this.validationService.validate(
      AuthValidation.EMAIL,
      email,
    );

    const user = await this.prismaService.user.findFirst({
      where: {
        email: emailRequest,
      },
    });

    if (!user) {
      this.logger.warn(`Pengguna dengan email ${emailRequest} tidak ditemukan`);
      throw new HttpException('Pengguna tidak ada', 404);
    }

    if (user.verifiedAccount) {
      this.logger.warn(
        `Akun dengan email ${emailRequest} sudah terverifikasi`,
      );
      throw new HttpException('Akun sudah terverifikasi. Silakan login.', 400);
    }

    const cooldownMinutes = 30;
    if (user.lastVerificationEmailSentAt) {
      const now = new Date();
      const lastSent = new Date(user.lastVerificationEmailSentAt);
      const timeElapsed = now.getTime() - lastSent.getTime();
      const remainingTime = cooldownMinutes * 60 * 1000 - timeElapsed;

      if (remainingTime > 0) {
        const totalSeconds = Math.ceil(remainingTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        let message = 'Tautan verifikasi sudah dikirim. Mohon tunggu ';
        if (minutes > 0) {
          message += `${minutes} menit `;
        }
        if (seconds > 0 || totalSeconds === 0) {
          message += `${seconds} detik `;
        }
        message += 'sebelum mencoba lagi.';

        throw new HttpException(message, 429);
      }
    }

    const payload = { id: user.id };
    const accountVerificationToken =
      await this.verificationJwtService.signAsync(payload);

    const backendUrl = this.urlHelper.getBaseUrl('backend');
    const verificationLink = `${backendUrl}/auth/verify-account/${accountVerificationToken}`;

    const sendEmail: SendEmail = {
      from: {
        name: this.configService.get<string>('APP_NAME'),
        address: this.configService.get<string>('MAIL_USER'),
      },
      receptients: [
        {
          name: user.name,
          address: user.email,
        },
      ],
      subject: 'Email Verifikasi',
      html: 'resend-verification-account',
      placeholderReplacements: {
        username: user.name,
        verificationLink: verificationLink,
      },
    };

    try {
      await this.mailService.sendEmail(sendEmail);
      this.logger.log('Email verifikasi berhasil dikirim ke: ' + user.email);
      this.logger.debug(
        `Token verifikasi tersimpan: ${accountVerificationToken.substring(
          0,
          20,
        )}...`,
      );

      await this.prismaService.user.update({
        where: { id: user.id },
        data: {
          lastVerificationEmailSentAt: new Date(),
          accountVerificationToken: accountVerificationToken,
        },
      });

      const updatedUserAfterResend = await this.prismaService.user.findUnique({
        where: { id: user.id },
        select: { accountVerificationToken: true },
      });
      this.logger.debug(
        `Resend: Token verifikasi yang disimpan di DB untuk user ${
          user.id
        } setelah resend: ${updatedUserAfterResend?.accountVerificationToken?.substring(
          0,
          20,
        )}...`,
      );
    } catch (emailError) {
      this.logger.error('Error sending verification email:', emailError);
      this.logger.warn(
        'Registrasi tetap dilanjutkan meskipun email gagal terkirim',
      );
    }

    return 'Email verifikasi sudah dikirim';
  }

  async passwordResetRequest(email: string): Promise<string> {
    this.logger.debug(
      `Memulai permintaan reset password untuk email: ${email}`,
    );

    const emailRequest = this.validationService.validate(
      AuthValidation.EMAIL,
      email,
    );

    const user = await this.prismaService.user.findFirst({
      where: {
        email: emailRequest,
      },
    });

    if (user) {
      const payload = { id: user.id };
      const passwordResetToken =
        await this.verificationJwtService.signAsync(payload);

      const backendUrl = this.urlHelper.getBaseUrl('backend');
      const resetPasswordLink = `${backendUrl}/auth/verify-reset-password/${passwordResetToken}`;

      const sendEmail = {
        from: {
          name: this.configService.get<string>('APP_NAME'),
          address: this.configService.get<string>('MAIL_USER'),
        },
        receptients: [
          {
            name: user.name,
            address: email,
          },
        ],
        subject: 'Reset Password',
        html: 'password-reset-verify',
        placeholderReplacements: {
          username: user.name,
          verificationLink: resetPasswordLink,
        },
      };

      try {
        await this.mailService.sendEmail(sendEmail);
        this.logger.debug(`Email reset password berhasil dikirim ke: ${email}`);
      } catch (emailError) {
        this.logger.error('Error sending reset password email:', emailError);
        this.logger.warn(
          'Proses reset password tetap dilanjutkan meskipun email gagal terkirim',
        );
      }

      await this.prismaService.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordResetToken,
        },
      });

      this.logger.debug(
        `Email reset password berhasil dikirim untuk pengguna: ${user.email}`,
      );
    }

    return 'Email reset password sudah dikirim';
  }

  async verifyPasswordResetRequestToken(token: string): Promise<boolean> {
    try {
      const verifyToken = await this.verificationJwtService.verifyAsync(token);
      const user = await this.prismaService.user.findUnique({
        where: {
          id: verifyToken.id,
        },
      });

      if (!user) {
        throw new HttpException('Pengguna tidak ditemukan', 404);
      }

      if (!user.passwordResetToken || user.passwordResetToken !== token) {
        throw new HttpException(
          'Token ini tidak valid atau sudah digunakan',
          400,
        );
      }
      return true;
    } catch (error) {
      throw new HttpException('Token tidak valid atau sudah kadaluarsa', 400);
    }
  }

  async resetPassword(request: UpdatePassword): Promise<string> {
    const resetPasswordRequest = this.validationService.validate(
      AuthValidation.UPDATEPASSWORD,
      request,
    );
    try {
      const verifyToken = await this.verificationJwtService.verifyAsync(
        request.token,
      );
      const user = await this.prismaService.user.findUnique({
        where: {
          id: verifyToken.id,
        },
      });

      if (!user) {
        throw new HttpException('Pengguna tidak ditemukan', 404);
      }

      if (
        !user.passwordResetToken ||
        user.passwordResetToken !== request.token
      ) {
        throw new HttpException(
          'Token ini tidak valid atau sudah digunakan',
          400,
        );
      }

      const hashedPassword = await bcrypt.hash(
        resetPasswordRequest.newPassword,
        10,
      );
      await this.prismaService.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
        },
      });

      return 'Password berhasil diubah';
    } catch (error) {
      throw new HttpException('Token tidak valid atau sudah kadaluarsa', 400);
    }
  }

  async updateEmailRequest(
    email: string,
    user: CurrentUserRequest,
  ): Promise<string> {
    this.logger.debug(
      `Memulai permintaan perubahan email untuk user ${user.id} ke ${email}`,
    );

    const emailRequest = this.validationService.validate(
      AuthValidation.EMAIL,
      email,
    );

    if (email === user.email) {
      this.logger.warn(
        `Email baru ${email} sama dengan email lama untuk user ${user.id}`,
      );
      throw new HttpException(
        'Gagal mengubah alamat email Anda. Email yang baru masih sama dengan email sebelumnya.',
        400,
      );
    }

    await this.checkUserExists(undefined, emailRequest);

    const payload = {
      id: user.id,
      email: emailRequest,
    };

    const updateEmailToken =
      await this.verificationJwtService.signAsync(payload);

    const backendUrl = this.urlHelper.getBaseUrl('backend');
    const verificationLink = `${backendUrl}/auth/update-email/verify/${updateEmailToken}`;

    const sendEmail: SendEmail = {
      from: {
        name: this.configService.get<string>('APP_NAME'),
        address: this.configService.get<string>('MAIL_USER'),
      },
      receptients: [
        {
          name: user.name,
          address: emailRequest,
        },
      ],
      subject: 'Verifikasi Email Baru',
      html: 'new-email-verify',
      placeholderReplacements: {
        username: user.name,
        newEmail: email,
        verificationLink: verificationLink,
      },
    };

    try {
      await this.mailService.sendEmail(sendEmail);
      this.logger.debug(
        `Email verifikasi untuk email baru ${emailRequest} berhasil dikirim`,
      );
    } catch (emailError) {
      this.logger.error('Error sending verification email:', emailError);
      this.logger.warn(
        'Registrasi tetap dilanjutkan meskipun email gagal terkirim',
      );
    }

    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        updateEmailToken: updateEmailToken,
      },
    });

    return 'Email verifikasi email baru telah terkirim';
  }

  async verifyUpdateEmailRequestToken(
    token: string,
    user: CurrentUserRequest,
  ): Promise<string> {
    try {
      const verifyToken = await this.verificationJwtService.verifyAsync(token);
      const findUser = await this.prismaService.user.findUnique({
        where: {
          id: verifyToken.id,
        },
      });

      if (!findUser) {
        throw new HttpException('Pengguna tidak ditemukan', 404);
      }

      if (
        !findUser.updateEmailToken ||
        findUser.updateEmailToken !== token ||
        findUser.email === verifyToken.email
      ) {
        throw new HttpException(
          'Token ini tidak valid atau sudah digunakan',
          400,
        );
      }

      await this.prismaService.$transaction(async (prisma) => {
        await prisma.user.update({
          where: {
            id: verifyToken.id,
          },
          data: {
            email: verifyToken.email,
            updateEmailToken: null,
          },
        });

        if (user.role.name === 'user') {
          const participant = await prisma.participant.findUnique({
            where: {
              id: user.participantId,
            },
          });

          if (participant) {
            await prisma.participant.update({
              where: {
                id: participant.id,
              },
              data: {
                email: verifyToken.email,
              },
            });
          }
        }
      });

      return 'Berhasil mengubah email';
    } catch (error) {
      console.log(error);
      throw new HttpException('Token tidak valid atau sudah kadaluarsa', 400);
    }
  }

  async updatePassword(
    request: UpdatePassword,
    user: CurrentUserRequest,
  ): Promise<string> {
    const updatePasswordRequest = this.validationService.validate(
      AuthValidation.UPDATEPASSWORD,
      request,
    );

    const hashedPassword = await bcrypt.hash(
      updatePasswordRequest.newPassword,
      10,
    );
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return 'Password berhasil diubah';
  }

  async logout(user: CurrentUserRequest): Promise<string> {
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { refreshToken: null },
    });
    return 'Logout berhasil';
  }

  async cleanupUnverifiedUsers(): Promise<number> {
    this.logger.log('Memulai pembersihan user yang belum terverifikasi');
    
    // Cari role 'user'
    const userRole = await this.prismaService.role.findFirst({
      where: { name: { equals: 'user', mode: 'insensitive' } },
    });
    
    if (!userRole) {
      this.logger.warn('Role "user" tidak ditemukan, tidak ada yang dibersihkan');
      return 0;
    }
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Cari user yang belum terverifikasi dan dibuat lebih dari 24 jam yang lalu
    const usersToDelete = await this.prismaService.user.findMany({
      where: {
        roleId: userRole.id,
        verifiedAccount: false,
        createdAt: { lt: twentyFourHoursAgo }
      },
      include: {
        participant: true
      }
    });
    
    let deletedCount = 0;
    
    // Hapus user satu per satu untuk memastikan data terkait juga dihapus
    for (const user of usersToDelete) {
      try {
        // Jika user memiliki data participant, hapus relasi terlebih dahulu
        if (user.participant) {
          await this.prismaService.user.update({
            where: { id: user.id },
            data: { participantId: null }
          });
        }
        
        // Hapus user
        await this.prismaService.user.delete({
          where: { id: user.id }
        });
        
        deletedCount++;
      } catch (error) {
        this.logger.error(`Gagal menghapus user ${user.id}: ${error.message}`);
      }
    }
    
    this.logger.log(`Berhasil menghapus ${deletedCount} user role 'user' yang belum terverifikasi setelah 24 jam`);
    return deletedCount;
  }

  private async checkUserExists(idNumber?: string, email?: string) {
    let user: User | null = null;

    if (idNumber) {
      user = await this.prismaService.user.findFirst({
        where: {
          idNumber: idNumber,
        },
      });
      if (user) {
        if (!user.verifiedAccount) {
          throw new HttpException(
            'Akun dengan Nomor Pegawai ini sudah terdaftar dan belum diverifikasi.',
            409,
          );
        } else {
          throw new HttpException(
            'Nomor Pegawai sudah digunakan. Silakan login.',
            409,
          );
        }
      }
    }

    if (email) {
      user = await this.prismaService.user.findFirst({
        where: {
          email: email,
        },
      });
      if (user) {
        if (!user.verifiedAccount) {
          throw new HttpException(
            'Akun dengan Email ini sudah terdaftar dan belum diverifikasi.',
            409,
          );
        } else {
          throw new HttpException('Email sudah digunakan. Silakan login.', 409);
        }
      }
    }
  }

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
      refreshToken: true,
      role: true,
    };
  }

  private toAuthResponse(
    user: User & { role?: { id: string; name: string }; participant?: any },
    accessToken?: string,
    refreshToken?: string,
  ): AuthResponse {
    const result: AuthResponse = {
      id: user.id,
      accessToken: accessToken,
      refreshToken: refreshToken,
      verifiedAccount: user.verifiedAccount || undefined,
      email: user.email || undefined,
      name: user.name || undefined,
      idNumber: user.idNumber || undefined,
      dinas: user.dinas || undefined,
      roleId: user.roleId || undefined,
      role: user.role
        ? { id: user.role.id, name: user.role.name }
        : undefined,
      participant: user.participant || undefined,
    };
    return result;
  }
} 