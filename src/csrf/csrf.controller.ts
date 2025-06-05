import { Controller, Get, Req, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import type { Request, Response } from 'express';

/**
 * Controller untuk mengelola token CSRF.
 * @description Menyediakan endpoint untuk mengambil token CSRF yang diperlukan untuk permintaan POST/DELETE.
 */
@ApiTags('CSRF')
@Controller('csrf')
export class CsrfController {
  /**
   * Mengambil token CSRF untuk digunakan dalam permintaan yang dilindungi CSRF.
   * @param req Objek Express Request untuk mengakses token CSRF.
   * @param res Objek Express Response untuk mengatur cookie CSRF.
   * @returns Objek berisi token CSRF.
   * @throws BadRequestException jika token CSRF tidak tersedia.
   * @example
   * GET /csrf/token
   * Response: { csrfToken: 'your-csrf-token' }
   */
  @Get('token')
  @ApiOperation({ summary: 'Mengambil token CSRF' })
  @ApiResponse({
    status: 200,
    description: 'Token CSRF berhasil diambil',
    type: Object,
  })
  @ApiResponse({ status: 400, description: 'Gagal menghasilkan token CSRF' })
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!req.csrfToken) {
      throw new BadRequestException('CSRF token generator is not available');
    }
    const token = req.csrfToken();
    res.cookie('_csrf', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 jam
    });
    return { csrfToken: token };
  }
}
