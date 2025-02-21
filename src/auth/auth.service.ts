import { HttpException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/service/prisma.service';
import { ValidationService } from '../common/service/validation.service';
import {
  AuthResponse,
  CurrentUserRequest,
  RegisterUserRequest,
  UpdatePassword,
} from '../model/auth.model';
import { LoginUserRequest } from '../model/auth.model';
import { AuthValidation } from './auth.validation';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { SendEmail } from 'src/model/mail.model';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { CoreHelper } from 'src/common/helpers/core.helper';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    private readonly validationService: ValidationService,
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly coreHelper: CoreHelper,
    @Inject('ACCESS_JWT_SERVICE') private readonly accessJwtService: JwtService,
    @Inject('REFRESH_JWT_SERVICE')
    private readonly refreshJwtService: JwtService,
    @Inject('VERIFICATION_JWT_SERVICE')
    private readonly verificationJwtService: JwtService,
  ) {}

  async register(req: RegisterUserRequest): Promise<string> {
    if (req.roleId) {
      throw new HttpException('Anda tidak berhak menentukan role', 403);
    }

    const defaultRole = await this.prismaService.role.findFirst({
      where: {
        name: { equals: 'user', mode: 'insensitive' },
      },
    });

    if (!defaultRole) {
      throw new HttpException('Role tidak ditemukan', 404);
    }

    req.roleId = defaultRole.id;
    const registerRequest: RegisterUserRequest =
      this.validationService.validate(AuthValidation.REGISTER, req);

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

    // Transaksi Prisma
    const [user] = await this.prismaService.$transaction(async (prisma) => {
      await this.coreHelper.ensureUniqueFields('participant', [
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
      ]);

      // Buat user
      const user = await prisma.user.create({
        data: registerRequest,
        select: authSelectedFields,
      });

      // Buat participant
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

      // Modifikasi qrCodeLink dengan ID peserta
      const link = this.configService
        .get<string>('QR_CODE_LINK')
        .replace('{id}', participant.id);

      // Generate QR code
      const qrCodeBase64 = await QRCode.toDataURL(link, { width: 500 });
      const qrCodeBuffer = Buffer.from(
        qrCodeBase64.replace(/^data:image\/png;base64,/, ''),
        'base64',
      );

      // Update peserta dengan QR code dan link
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          qrCode: qrCodeBuffer,
        },
      });

      // Update user dengan participantId
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { participantId: participant.id },
      });

      return [updatedUser, participant];
    });

    // Generate token
    const payload = { id: user.id };
    const accountVerificationToken =
      await this.verificationJwtService.signAsync(payload);

    // Kirim email verifikasi
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';

    for (const interfaceName in networkInterfaces) {
      const addresses = networkInterfaces[interfaceName];
      if (addresses) {
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            localIp = addr.address;
            break;
          }
        }
      }
    }

    const verificationLink = `http://${localIp}:3000/auth/verify-account/${accountVerificationToken}`;

    const email: SendEmail = {
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
      html: 'verify-account',
      placeholderReplacements: {
        username: user.name,
        verificationLink: verificationLink,
      },
    };

    await this.mailService.sendEmail(email);

    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        accountVerificationToken: accountVerificationToken,
      },
    });

    return 'Registrasi berhasil';
  }

  async accountVerification(token: string): Promise<AuthResponse> {
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

      if (
        !user.accountVerificationToken ||
        user.accountVerificationToken !== token
      ) {
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
      });

      return this.toAuthResponse({
        refreshToken,
        accessToken,
      });
    } catch (error) {
      console.log(error);
      throw new HttpException('Token tidak valid atau telah kadaluarsa', 400);
    }
  }

  async login(req: LoginUserRequest): Promise<AuthResponse> {
    const loginRequest: LoginUserRequest = this.validationService.validate(
      AuthValidation.LOGIN,
      req,
    );

    let user: any;
    if (loginRequest.identifier.includes('@')) {
      user = await this.prismaService.user.findFirst({
        where: {
          email: loginRequest.identifier,
        },
      });
    } else {
      user = await this.prismaService.user.findFirst({
        where: {
          idNumber: loginRequest.identifier,
        },
      });
    }

    if (!user) {
      throw new HttpException(
        'Nomor Pegawai, email, atau kata sandi yang Anda masukkan tidak valid.',
        400,
      );
    }

    if (!user.verifiedAccount) {
      throw new HttpException('Akun belum diverifikasi', 403);
    }

    const isPasswordValid = await bcrypt.compare(
      loginRequest.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new HttpException(
        'Nomor Pegawai, email, atau kata sandi yang Anda masukkan tidak valid.',
        400,
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
      });

      return this.toAuthResponse({
        id: user.id,
        accessToken,
        refreshToken,
      });
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
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new HttpException('Unauthorized', 401);
      }

      const payload = { id: user.id };
      const newAccessToken = await this.accessJwtService.signAsync(payload);

      return this.toAuthResponse({
        id: user.id,
        accessToken: newAccessToken,
      });
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

    const { refreshToken, ...data } = findUser;
    const result: AuthResponse = data;
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

      // Check if all required fields are not null or undefined
      const isComplete = requiredFields.every(
        (field) =>
          findUser.participant[field] !== null &&
          findUser.participant[field] !== undefined,
      );
      result.isDataComplete = isComplete;
    }

    return this.toAuthResponse(result);
  }

  async resendVerificationLink(email: string): Promise<string> {
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
      throw new HttpException('Pengguna tidak ada', 404);
    }

    if (user.verifiedAccount) {
      throw new HttpException('Akun anda sudah terverifikasi', 400);
    }

    // Buat token reset password
    const payload = { id: user.id };
    const accountVerificationToken =
      await this.verificationJwtService.signAsync(payload);

    // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost'; // Default fallback

    // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
    for (const interfaceName in networkInterfaces) {
      const addresses = networkInterfaces[interfaceName];
      if (addresses) {
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
            break;
          }
        }
      }
    }

    const verificationLink = `http://${localIp}:3000/auth/verify-account/${accountVerificationToken}`;

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

    await this.mailService.sendEmail(sendEmail);

    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        accountVerificationToken: accountVerificationToken,
      },
    });

    return 'Email verifikasi sudah dikirim';
  }

  async passwordResetRequest(email: string): Promise<string> {
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
      // Buat token reset password
      const payload = { id: user.id };
      const passwordResetToken =
        await this.verificationJwtService.signAsync(payload);

      // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
      const networkInterfaces = os.networkInterfaces();
      let localIp = 'localhost'; // Default fallback

      // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
      for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        if (addresses) {
          for (const addr of addresses) {
            if (addr.family === 'IPv4' && !addr.internal) {
              localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
              break;
            }
          }
        }
      }

      // Kirim email reset password
      const resetPasswordLink = `http://${localIp}:3000/auth/verify-reset-password/${passwordResetToken}`;
      await this.mailService.sendEmail({
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
      });

      await this.prismaService.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordResetToken,
        },
      });
    }

    return 'Email reset password sudah dikirim';
  }

  async verifyPasswordResetRequestToken(token: string): Promise<boolean> {
    try {
      // Verifikasi token
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
      // Verifikasi token
      const verifyToken = await this.verificationJwtService.verifyAsync(
        request.token,
      );
      // Cari user berdasarkan email
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

      // Hash password baru dan update di database
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
    const emailRequest = this.validationService.validate(
      AuthValidation.EMAIL,
      email,
    );

    if (email === user.email) {
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

    // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost'; // Default fallback

    // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
    for (const interfaceName in networkInterfaces) {
      const addresses = networkInterfaces[interfaceName];
      if (addresses) {
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
            break;
          }
        }
      }
    }

    const verificationLink = `http://${localIp}:3000/auth/update-email/verify/${updateEmailToken}`;

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

    await this.mailService.sendEmail(sendEmail);

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
      // Verifikasi token
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
        // Update tabel `user`
        await prisma.user.update({
          where: {
            id: verifyToken.id,
          },
          data: {
            email: verifyToken.email,
            updateEmailToken: null,
          },
        });

        // Jika role adalah 'user', update tabel `participants`
        if (user.role.name === 'user') {
          const participant = await prisma.participant.findUnique({
            where: {
              id: user.participantId, // Asumsikan `nik` adalah kolom penghubung
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
      where: {
        id: user.id,
      },
      data: {
        refreshToken: null,
      },
    });

    return 'Logout berhasil';
  }

  private async checkUserExists(idNumber?: string, email?: string) {
    if (idNumber) {
      const totalUserwithSameNoPegawai = await this.prismaService.user.count({
        where: {
          idNumber: idNumber,
        },
      });

      if (totalUserwithSameNoPegawai != 0) {
        throw new HttpException('No pegawai sudah digunakan', 400);
      }
    }

    if (email) {
      const totalUserwithSameEmail = await this.prismaService.user.count({
        where: {
          email: email,
        },
      });

      if (totalUserwithSameEmail != 0) {
        throw new HttpException('Email sudah digunakan', 400);
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

  private toAuthResponse(user: AuthResponse): AuthResponse {
    return {
      id: user.id,
      idNumber: user.idNumber,
      email: user.email,
      name: user.name,
      dinas: user.dinas,
      refreshToken: user.refreshToken,
      accessToken: user.accessToken,
      role: user.role,
      participant: user.participant,
      isDataComplete: user.isDataComplete,
    };
  }
}
