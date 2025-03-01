import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../shared/guard/auth.guard";
import { AuthResponse, CurrentUserRequest, LoginUserRequest, RegisterUserRequest, UpdatePassword } from "../model/auth.model";
import { buildResponse, WebResponse } from "../model/web.model";
import { AuthService } from "./auth.service";
import { Response } from "express";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import * as os from 'os';
import { User } from "src/shared/decorator/user.decorator";
import { GetCookie } from "src/shared/decorator/cookie.decorator";

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

    // @Get('/verify-account/:token')
    // async accountVerification(@Param('token') token: string, @Res() res: Response): Promise<void> {
    //     // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
    //     const networkInterfaces = os.networkInterfaces();
    //     let localIp = 'localhost'; // Default fallback
        
    //     // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
    //     for (const interfaceName in networkInterfaces) {
    //         const addresses = networkInterfaces[interfaceName];
    //         if (addresses) {
    //             for (const addr of addresses) {
    //                 if (addr.family === 'IPv4' && !addr.internal) {
    //                     localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
    //                     break;
    //                 }
    //             }
    //         }
    //     }

    //     try {
    //         const result = await this.authService.accountVerification(token);
            
    //         res.cookie('refresh_token', result.refreshToken, {
    //             httpOnly: true,
    //             secure: this.configService.get<string>('NODE_ENV') === 'production',
    //             sameSite: 'lax',
    //             path: '/',
    //             maxAge: 1000 * 60 * 60 * 24,
    //         });
            
    //         res.cookie('access_token', result.accessToken, {
    //             httpOnly: true,
    //             secure: this.configService.get<string>('NODE_ENV') === 'production',
    //             sameSite: 'lax',
    //             path: '/',
    //             maxAge: 1000 * 60 * 60 * 24,
    //         });
            
    //         const redirectUrl = `http://${localIp}:4200/home`;
    //         return res.redirect(redirectUrl);
    //     } catch (error) {
    //         // Tangani kesalahan dengan redirect ke halaman login atau halaman error
    //         console.log(error);
    //         const redirectUrl = `http://${localIp}:4200/verification?error=${error.message}`;
    //         return res.redirect(redirectUrl);
    //     }
    // }

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

            const redirectUrl = `${frontendUrl}/home`;
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
    async login(@Body() request: LoginUserRequest, @Res({ passthrough: true }) res: Response): Promise<WebResponse<string>> {
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
        return buildResponse(HttpStatus.OK, 'Login Berhasil');
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

    // @Get('/verify-reset-password/:token')
    // async verifyPasswordResetRequestToken(@Param('token') token: string, @Res() res: Response): Promise<WebResponse<boolean>> {
    //     // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
    //     const networkInterfaces = os.networkInterfaces();
    //     let localIp = 'localhost'; // Default fallback
        
    //     // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
    //     for (const interfaceName in networkInterfaces) {
    //         const addresses = networkInterfaces[interfaceName];
    //         if (addresses) {
    //             for (const addr of addresses) {
    //                 if (addr.family === 'IPv4' && !addr.internal) {
    //                     localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
    //                     break;
    //                 }
    //             }
    //         }
    //     }

    //     try {
    //         const result = await this.authService.verifyPasswordResetRequestToken(token);
    //         res.redirect(`http://${localIp}:4200/reset/${token}`);
    //         return buildResponse(HttpStatus.OK, result);
    //     } catch (error) {
    //         // Tangani kesalahan dengan redirect ke halaman login atau halaman error
    //         console.log(error);
    //         const redirectUrl = `http://${localIp}:4200/password-reset?error=${error.message}`;
    //         res.redirect(redirectUrl);
    //     }
    // }

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

    // @Get('/update-email/verify/:token')
    // @HttpCode(200)
    // @UseGuards(AuthGuard)
    // async verifyUpdateEmailRequestToken(@User() user: CurrentUserRequest, @Param('token') token: string, @Res() res: Response): Promise<WebResponse<string>>{
    //     // Dapatkan alamat IP lokal secara dinamis untuk tahap pengembangan
    //     const networkInterfaces = os.networkInterfaces();
    //     let localIp = 'localhost'; // Default fallback
        
    //     // Iterasi melalui antarmuka jaringan untuk menemukan alamat IPv4 pertama
    //     for (const interfaceName in networkInterfaces) {
    //         const addresses = networkInterfaces[interfaceName];
    //         if (addresses) {
    //             for (const addr of addresses) {
    //                 if (addr.family === 'IPv4' && !addr.internal) {
    //                     localIp = addr.address; // Tetapkan alamat IPv4 non-internal pertama
    //                     break;
    //                 }
    //             }
    //         }
    //     }

    //     try {
    //         const result = await this.authService.verifyUpdateEmailRequestToken(token, user);
    //         if(user.role.name.toLowerCase() === 'user') {
    //             res.redirect(`http://${localIp}:4200/participants/${user.participantId}/profile/account?success=${result}`);
    //         } else {
    //             res.redirect(`http://${localIp}:4200/users/${user.id}/account?success=${result}`)
    //         }
    //         return buildResponse(HttpStatus.OK, result);
    //     } catch (error) {
    //         // Tangani kesalahan dengan redirect ke halaman login atau halaman error
    //         console.log(error);
    //         if(user) {
    //             if(user.role.name.toLowerCase() === 'user') {
    //                 res.redirect(`http://${localIp}:4200/participants/${user.participantId}/profile/account?error=${error.message}`);
    //             } else {
    //                 res.redirect(`http://${localIp}:4200/users/${user.id}/account?error=${error.message}`)
    //             }
    //         } else {
    //             const redirectUrl = `http://${localIp}:4200/home`;
    //             res.redirect(redirectUrl);
    //         }
    //     }
    // }

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
            const redirectUrl = `${frontendUrl}/home?error=${encodeURIComponent('Token tidak valid')}`;
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
}