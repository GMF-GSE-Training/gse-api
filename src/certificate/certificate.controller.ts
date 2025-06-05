import {
  Body,
  Controller,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';

import { CreateCertificate } from '../model/certificate.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import { CertificateService } from './certificate.service.js';

/**
 *
 */
@Controller('/certificate')
export class CertificateController {
  /**
   *
   * @param certificateService
   */
  constructor(private readonly certificateService: CertificateService) {}

  /**
   *
   * @param cotId
   * @param participantId
   * @param request
   */
  @Post('/:cotId/:participantId')
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async create(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() request: CreateCertificate
  ): Promise<any> {
    try {
      const result = await this.certificateService.createCertificate(
        cotId,
        participantId,
        request
      );
      const filename = `Certificate_${participantId}.pdf`;
      return new StreamableFile(result, {
        type: 'application/pdf',
        disposition: `attachment; filename="${filename}"`,
      });
    } catch (error) {
      console.log(error);
      throw new HttpException(error.message, error.status || 500);
    }
  }
}
