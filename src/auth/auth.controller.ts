import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Res, UseGuards, HttpException, Query } from "@nestjs/common";
import { AuthGuard } from "../shared/guard/auth.guard";
import { AuthResponse, CurrentUserRequest, LoginUserRequest, RegisterUserRequest, UpdatePassword } from "../model/auth.model";
import { buildResponse, WebResponse } from "../model/web.model";
import { AuthService } from "./auth.service";
import { Response, Request } from "express";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import * as os from 'os';
import { User } from "src/shared/decorator/user.decorator";
import { GetCookie } from "src/shared/decorator/cookie.decorator";
import { Cron } from '@nestjs/schedule';

@Controller('/auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    private getBaseUrl(type: 'frontend' | 'backend'): string {
        const protocol = this.configService.get<string>('PROTOCOL') || 'http';
        const host = this.configService.get<string>('HOST') || 'localhost';
        const port = this.configService.get<string>(type === 'frontend' ? 'FRONTEND_PORT' : 'PORT') || '4200';

        const envUrl = this.configService.get<string>(type === 'frontend' ? 'FRONTEND_URL' : 'BACKEND_URL');
        if (envUrl) {
            this.logger.debug(`Menggunakan ${type} URL dari .env: ${envUrl}`);
            return envUrl;
        }

        const constructedUrl = `${protocol}://${host}:${port}`;
        this.logger.warn(`Tidak ada ${type} URL di .env, menggunakan URL default: ${constructedUrl}`);
        return constructedUrl;
    }

    @Post('/register')
    @HttpCode(200)
    async register(@Body() req: RegisterUserRequest): Promise<WebResponse<string>> {
        const result = await this.authService.register(req);
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/verify-account/:token')
    async accountVerification(@Param('token') token: string, @Res() res: Response): Promise<void> {
        this.logger.debug(`Memulai verifikasi akun dengan token: ${token}`);

        // Validasi token awal
        if (!token || token.trim() === '') {
            this.logger.warn('Token tidak ada atau tidak valid');
            const frontendUrl = this.getBaseUrl('frontend');
            const redirectUrl = `${frontendUrl}/verification?error=${encodeURIComponent('Token tidak valid')}`;
            return res.redirect(redirectUrl);
        }

        const frontendUrl = this.getBaseUrl('frontend');

        try {
            const result = await this.authService.accountVerification(token);
            const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

            res.cookie('refresh_token', result.refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                path: '/',
                maxAge: 1000 * 60 * 60 * 24,
            });

            res.cookie('access_token', result.accessToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                path: '/',
                maxAge: 1000 * 60 * 60 * 24,
            });

            const redirectUrl = `${frontendUrl}/dashboard`;
            this.logger.debug(`Berhasil verifikasi, mengarahkan ke: ${redirectUrl}`);
            return res.redirect(redirectUrl);
        } catch (error) {
            this.logger.error('Gagal memverifikasi akun', error.stack);
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
            const redirectUrl = `${frontendUrl}/verification?error=${encodeURIComponent(errorMessage)}`;
            return res.redirect(redirectUrl);
        }
    }

    @Post('/login')
    @HttpCode(200)
    async login(@Body() request: LoginUserRequest, @Res({ passthrough: true }) res: Response): Promise<WebResponse<AuthResponse>> {
        const result = await this.authService.login(request);
        res.cookie('refresh_token', result.refreshToken, {
            httpOnly: true,
            secure: this.configService.get<string>('NODE_ENV') === 'production',
            // domain: this.configService.get<string>('HOST'),
            sameSite: 'lax',
            path: '/',
            maxAge: 1000 * 60 * 60 * 24,
        });

        res.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure: this.configService.get<string>('NODE_ENV') === 'production',
            // domain: this.configService.get<string>('HOST'),
            sameSite: 'lax',
            path: '/',
            maxAge: 1000 * 60 * 60 * 24,
        });
        // const { refreshToken, ...response } = result;
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/token')
    @HttpCode(200)
    async refreshTokens(@GetCookie('refresh_token') refreshToken: string, @Res({ passthrough: true }) res: Response): Promise<WebResponse<string>> {
        const result = await this.authService.refreshTokens(refreshToken);
        res.cookie('access_token', result.accessToken, {
            httpOnly: true,
            secure: this.configService.get<string>('NODE_ENV') === 'production',
            // domain: this.configService.get<string>('HOST'),
            sameSite: 'lax',
            path: '/',
            maxAge: 1000 * 60 * 60 * 24,
        });
        return buildResponse(HttpStatus.OK, "Access token berhasil diperbarui");
    }

    @Get('/current')    
    @HttpCode(200)
    @UseGuards(AuthGuard)
    async profile(@User() user: CurrentUserRequest): Promise<WebResponse<AuthResponse>> {
        const result = await this.authService.profile(user);
        return buildResponse(HttpStatus.OK, result);
    }

    @Post('/resend-verification')
    @HttpCode(200)
    async resendVerification(@Body('email') email: string): Promise<WebResponse<string>> {
        const result = await this.authService.resendVerificationLink(email);
        return buildResponse(HttpStatus.OK, result);
    }

    @Post('/request-reset-password')
    @HttpCode(200)
    async passwordResetRequest(@Body('email') email: string): Promise<WebResponse<string>> {
        const result = await this.authService.passwordResetRequest(email);
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/verify-reset-password/:token')
    async verifyPasswordResetRequestToken(
        @Param('token') token: string,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.debug(`Memulai verifikasi reset password dengan token: ${token}`);

        // Validasi token
        if (!token || token.trim() === '') {
            this.logger.warn('Token tidak ada atau tidak valid');
            const frontendUrl = this.getBaseUrl('frontend');
            const redirectUrl = `${frontendUrl}/password-reset?error=${encodeURIComponent('Token tidak diberikan')}`;
            return res.redirect(redirectUrl);
        }

        // Ambil URL frontend dari .env
        const frontendUrl = this.getBaseUrl('frontend');

        try {
            await this.authService.verifyPasswordResetRequestToken(token);
            const redirectUrl = `${frontendUrl}/reset/${token}`;
            this.logger.debug(`Token valid, mengarahkan ke: ${redirectUrl}`);
            return res.redirect(redirectUrl);
        } catch (error) {
            this.logger.error('Gagal memverifikasi token reset password', error.stack);
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
            const redirectUrl = `${frontendUrl}/password-reset?error=${encodeURIComponent(errorMessage)}`;
            return res.redirect(redirectUrl);
        }
    }

    @Post('/reset-password')
    async resetPassword(@Body() request: UpdatePassword): Promise<WebResponse<string>> {
        const result = await this.authService.resetPassword(request);
        return buildResponse(HttpStatus.OK, result);
    }

    @Post('/update-email')
    @HttpCode(200)
    @UseGuards(AuthGuard)
    async updateEmailRequest(@User() user: CurrentUserRequest, @Body('email') email: string): Promise<WebResponse<string>> {
        const result = await this.authService.updateEmailRequest(email, user);
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/update-email/verify/:token')
    @HttpCode(200)
    @UseGuards(AuthGuard)
    async verifyUpdateEmailRequestToken(
        @User() user: CurrentUserRequest,
        @Param('token') token: string,
        @Res() res: Response,
    ): Promise<void> {
        this.logger.debug(`Memulai verifikasi perubahan email untuk user ${user.id} dengan token: ${token}`);

        // Validasi token
        if (!token || token.trim() === '') {
            this.logger.warn('Token tidak ada atau tidak valid');
            const frontendUrl = this.getBaseUrl('frontend');
            const redirectUrl = `${frontendUrl}/dashboard?error=${encodeURIComponent('Token tidak valid')}`;
            return res.redirect(redirectUrl);
        }

        // Ambil URL frontend dari .env
        const frontendUrl = this.getBaseUrl('frontend');

        try {
            const result = await this.authService.verifyUpdateEmailRequestToken(token, user);
            let redirectUrl: string;

            if (user.role.name.toLowerCase() === 'user') {
                redirectUrl = `${frontendUrl}/participants/${user.participantId}/profile/account?success=${encodeURIComponent(result)}`;
            } else {
                redirectUrl = `${frontendUrl}/users/${user.id}/account?success=${encodeURIComponent(result)}`;
            }

            this.logger.debug(`Verifikasi berhasil, mengarahkan ke: ${redirectUrl}`);
            return res.redirect(redirectUrl);
        } catch (error) {
            this.logger.error('Gagal memverifikasi perubahan email', error.stack);
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
            let redirectUrl: string;

            if (user) {
                if (user.role.name.toLowerCase() === 'user') {
                    redirectUrl = `${frontendUrl}/participants/${user.participantId}/profile/account?error=${encodeURIComponent(errorMessage)}`;
                } else {
                    redirectUrl = `${frontendUrl}/users/${user.id}/account?error=${encodeURIComponent(errorMessage)}`;
                }
            } else {
                redirectUrl = `${frontendUrl}/home`;
            }

            return res.redirect(redirectUrl);
        }
    }

    @Post('/update-password')
    @HttpCode(200)
    @UseGuards(AuthGuard)
    async updatePassword(@Body() request: UpdatePassword, @User() user: CurrentUserRequest): Promise<WebResponse<string>> {
        const result = await this.authService.updatePassword(request, user);
        return buildResponse(HttpStatus.OK, result);
    }

    @Delete('/current')
    @HttpCode(200)
    @UseGuards(AuthGuard)
    async logout(@User() req: CurrentUserRequest, @Res({ passthrough: true }) res: Response): Promise<WebResponse<string>> {
        const result = await this.authService.logout(req);
        res.clearCookie('refresh_token');
        res.clearCookie('access_token');
        return buildResponse(HttpStatus.OK, result);
    }

    @Post('/verify')
    @HttpCode(200)
    async verifyToken(
        @Body('token') token: string,
        @Res({ passthrough: true }) res: Response,
    ): Promise<WebResponse<string>> {
        this.logger.debug(`Memulai verifikasi akun dengan token dari frontend: ${token}`);

        if (!token || token.trim() === '') {
            throw new HttpException('Token tidak valid', HttpStatus.BAD_REQUEST);
        }

        try {
            // Lakukan verifikasi dan dapatkan token akses & refresh
            const result = await this.authService.accountVerification(token);

            // Pasang cookie agar user langsung ter‐login seperti flow /verify-account/:token
            const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
            res.cookie('refresh_token', result.refreshToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                path: '/',
                maxAge: 1000 * 60 * 60 * 24, // 1 day
            });
            res.cookie('access_token', result.accessToken, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? 'strict' : 'lax',
                path: '/',
                maxAge: 1000 * 60 * 60 * 24,
            });

            return buildResponse(HttpStatus.OK, 'Akun berhasil diverifikasi');
        } catch (error) {
            this.logger.error('Gagal memverifikasi akun', error instanceof Error ? error.stack : `${error}`);
            throw error;
        }
    }

    // Cron job untuk menghapus user yang belum terverifikasi setelah 20 menit
    @Cron('0 17 * * *') // Jalankan setiap hari pada pukul 00:00 WIB (17:00 UTC)
    async cleanupUnverifiedUsers() {
        try {
            this.logger.log('Menjalankan pembersihan user yang belum terverifikasi');
            const result = await this.authService.cleanupUnverifiedUsers();
            this.logger.log(`Berhasil menghapus ${result} user yang belum terverifikasi setelah 20 menit`);
        } catch (error) {
            this.logger.error('Gagal menjalankan pembersihan user:', error);
        }
    }
}