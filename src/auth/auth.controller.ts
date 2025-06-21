import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import type { Response, Request } from 'express';

import { UrlHelper } from '../common/helpers/url.helper.js';
import type {
  AuthResponse,
  CurrentUserRequest,
  LoginUserRequest,
  RegisterUserRequest,
  UpdatePassword,
} from '../model/auth.model.js';
import { buildResponse, WebResponse } from '../model/web.model.js';
import { GetCookie } from '../shared/decorator/cookie.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';

import { AuthService } from './auth.service.js';

/**
 * Controller untuk mengelola autentikasi pengguna.
 * @description Menangani endpoint terkait registrasi, login, logout, dan manajemen autentikasi lainnya.
 */
@ApiTags('Authentication')
@Controller('/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  /**
   * Konstruktor untuk menginisialisasi dependensi.
   * @param authService - Service untuk logika autentikasi.
   * @param configService - Service untuk mengakses variabel lingkungan.
   * @param urlHelper - Helper untuk manipulasi URL.
   */
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly urlHelper: UrlHelper
  ) {}

  /**
   * Mendaftarkan pengguna baru.
   * @param req - Data permintaan registrasi.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Post('/register')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 200, description: 'User registered successfully' })
  async register(
    @Body() req: RegisterUserRequest
  ): Promise<WebResponse<string>> {
    const result = await this.authService.register(req);
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Memverifikasi akun pengguna menggunakan token.
   * @param token - Token verifikasi akun.
   * @param res - Objek respons untuk pengalihan.
   */
  @Get('/verify-account/:token')
  @ApiOperation({ summary: 'Verify user account' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend after verification',
  })
  async accountVerification(
    @Param('token') token: string,
    @Res() res: Response
  ): Promise<void> {
    this.logger.debug(`Memulai verifikasi akun dengan token: ${token}`);

    if (!token || token.trim() === '') {
      this.logger.warn('Token tidak ada atau tidak valid');
      const frontendUrl = this.urlHelper.getBaseUrl('frontend');
      const redirectUrl = `${frontendUrl}/verification?error=${encodeURIComponent('Token tidak valid')}`;
      return res.redirect(redirectUrl);
    }

    const frontendUrl = this.urlHelper.getBaseUrl('frontend');

    try {
      const result = await this.authService.accountVerification(token);
      const isProduction =
        this.configService.get<string>('NODE_ENV') === 'production';

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/',
        maxAge: 60 * 60 * 1000,
      });

      const redirectUrl = `${frontendUrl}/home`;
      this.logger.debug(`Berhasil verifikasi, mengarahkan ke: ${redirectUrl}`);
      return res.redirect(redirectUrl);
    } catch (error: unknown) {
      this.logger.error('Gagal memverifikasi akun', (error as Error).stack);
      const errorMessage =
        error instanceof Error ? error.message : 'Terjadi kesalahan';
      const redirectUrl = `${frontendUrl}/verification?error=${encodeURIComponent(errorMessage)}`;
      return res.redirect(redirectUrl);
    }
  }

  /**
   * Login pengguna dengan kredensial.
   * @param request - Data permintaan login.
   * @param res - Objek respons untuk pengaturan cookie.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  async login(
    @Body() request: LoginUserRequest,
    @Res({ passthrough: true }) res: Response
  ): Promise<WebResponse<string>> {
    const result = await this.authService.login(request);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });

    return buildResponse('Login Berhasil', undefined, 'success');
  }

  /**
   * Memperbarui token akses menggunakan token refresh.
   * @param refreshToken - Token refresh dari cookie.
   * @param res - Objek respons untuk pengaturan cookie.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Get('/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully',
  })
  async refreshTokens(
    @GetCookie('refresh_token') refreshToken: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<WebResponse<string>> {
    const result = await this.authService.refreshTokens(refreshToken);
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    return buildResponse(
      'Access token berhasil diperbarui',
      undefined,
      'success'
    );
  }

  /**
   * Mendapatkan profil pengguna saat ini.
   * @param user - Data pengguna saat ini.
   * @returns Respons dengan data profil pengguna.
   */
  @Get('/current')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async profile(
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<AuthResponse>> {
    const result = await this.authService.profile(user);
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Mengirim ulang email verifikasi akun.
   * @param email - Alamat email pengguna.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Post('/resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email resent successfully',
  })
  async resendVerification(
    @Body('email') email: string
  ): Promise<WebResponse<string>> {
    const result = await this.authService.resendVerificationLink(email);
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Meminta email reset kata sandi.
   * @param email - Alamat email pengguna.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Post('/request-reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully',
  })
  async passwordResetRequest(
    @Body('email') email: string
  ): Promise<WebResponse<string>> {
    const result = await this.authService.passwordResetRequest(email);
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Memverifikasi token reset kata sandi.
   * @param token - Token reset kata sandi.
   * @param res - Objek respons untuk pengalihan.
   */
  @Get('/verify-reset-password/:token')
  @ApiOperation({ summary: 'Verify password reset token' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend after verification',
  })
  async verifyPasswordResetRequestToken(
    @Param('token') token: string,
    @Res() res: Response
  ): Promise<void> {
    this.logger.debug(
      `Memulai verifikasi token reset password dengan token: ${token}`
    );

    if (!token || token.trim() === '') {
      this.logger.warn('Token tidak ada atau tidak valid');
      const frontendUrl = this.urlHelper.getBaseUrl('frontend');
      const redirectUrl = `${frontendUrl}/reset-password?error=${encodeURIComponent('Token tidak valid')}`;
      return res.redirect(redirectUrl);
    }

    const frontendUrl = this.urlHelper.getBaseUrl('frontend');

    try {
      const result =
        await this.authService.verifyPasswordResetRequestToken(token);
      const redirectUrl = `${frontendUrl}/reset/${token}`;
      this.logger.debug(`Token valid, mengarahkan ke: ${redirectUrl}`);
      return res.redirect(redirectUrl);
    } catch (error: unknown) {
      this.logger.error(
        'Gagal memverifikasi token reset password',
        (error as Error).stack
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Terjadi kesalahan';
      const redirectUrl = `${frontendUrl}/reset-password?error=${encodeURIComponent(errorMessage)}`;
      return res.redirect(redirectUrl);
    }
  }

  /**
   * Mereset kata sandi pengguna.
   * @param request - Data permintaan reset kata sandi.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Post('/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(
    @Body() request: UpdatePassword
  ): Promise<WebResponse<string>> {
    const result = await this.authService.resetPassword(request);
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Meminta pembaruan email.
   * @param user - Data pengguna saat ini.
   * @param email - Alamat email baru.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Post('/update-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request email update' })
  @ApiResponse({
    status: 200,
    description: 'Email update verification sent successfully',
  })
  async updateEmailRequest(
    @User() user: CurrentUserRequest,
    @Body('email') email: string
  ): Promise<WebResponse<string>> {
    const result = await this.authService.updateEmailRequest(user, email);
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Memverifikasi permintaan pembaruan email.
   * @param user - Data pengguna saat ini.
   * @param token - Token verifikasi email.
   * @param res - Objek respons untuk pengalihan.
   */
  @Get('/verify-update-email/:token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify user email update request',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend after email update verification',
  })
  async verifyUpdateEmailRequestToken(
    @User() user: CurrentUserRequest,
    @Param('token') token: string,
    @Res() res: Response
  ): Promise<void> {
    this.logger.debug(
      `Memulai verifikasi token perubahan email dengan token: ${token}`
    );

    if (!token || token.trim() === '') {
      this.logger.warn('Token tidak ada atau tidak valid');
      const frontendUrl = this.urlHelper.getBaseUrl('frontend');
      const redirectUrl = `${frontendUrl}/profile?error=${encodeURIComponent('Token tidak valid')}`;
      return res.redirect(redirectUrl);
    }

    const frontendUrl = this.urlHelper.getBaseUrl('frontend');

    try {
      const result = await this.authService.verifyUpdateEmailRequestToken(
        user,
        token
      );
      const redirectUrl = `${frontendUrl}/profile`;
      this.logger.debug(`Verifikasi berhasil, mengarahkan ke: ${redirectUrl}`);
      return res.redirect(redirectUrl);
    } catch (error: unknown) {
      this.logger.error(
        'Gagal memverifikasi perubahan email',
        (error as Error).stack
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Terjadi kesalahan';
      const redirectUrl = `${frontendUrl}/profile?error=${encodeURIComponent(errorMessage)}`;
      return res.redirect(redirectUrl);
    }
  }

  /**
   * Memperbarui kata sandi pengguna.
   * @param request - Data permintaan pembaruan kata sandi.
   * @param user - Data pengguna saat ini.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Post('/update-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({
    status: 200,
    description: 'User password updated successfully',
  })
  async updatePassword(
    @Body() request: UpdatePassword,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const result = await this.authService.updatePassword(user, request);
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Logout pengguna dari sesi saat ini.
   * @param user - Data pengguna saat ini.
   * @param res - Objek respons untuk menghapus cookie.
   * @param refreshToken - Token refresh dari cookie.
   * @returns Respons dengan pesan keberhasilan.
   */
  @Delete('/current')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'User logged out successfully' })
  async logout(
    @User() user: CurrentUserRequest,
    @Res({ passthrough: true }) res: Response,
    @GetCookie('refresh_token') refreshToken: string
  ): Promise<WebResponse<string>> {
    const result = await this.authService.logout(user, refreshToken);
    res.clearCookie('refresh_token');
    res.clearCookie('access_token');
    return buildResponse(result, undefined, 'success');
  }

  /**
   * Memeriksa status kesehatan layanan autentikasi.
   * @returns Status kesehatan layanan.
   */
  @Get('/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check authentication service health' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  async healthCheck(): Promise<WebResponse<string>> {
    return buildResponse(
      'Authentication service is healthy',
      undefined,
      'success'
    );
  }
}
