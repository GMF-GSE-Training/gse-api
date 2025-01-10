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
import { CertificateService } from './certificate.service';
import { Roles } from 'src/shared/decorator/role.decorator';
import { AuthGuard } from 'src/shared/guard/auth.guard';
import { RoleGuard } from 'src/shared/guard/role.guard';
import { CreateCertificate } from 'src/model/certificate.model';

@Controller('/certificate')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post('/:cotId/:participantId')
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async create(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() request: CreateCertificate,
  ): Promise<any> {
    try {
      const result = await this.certificateService.createCertificate(
        cotId,
        participantId,
        request,
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
