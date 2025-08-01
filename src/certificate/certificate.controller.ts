import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
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
import { buildResponse, WebResponse } from 'src/model/web.model';

@Controller('/certificate')
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
  ) {}

  @Post('/:cotId/:participantId')
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async create(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() request: CreateCertificate,
  ): Promise<WebResponse<string>> {
    try {
      const result = await this.certificateService.createCertificate(
        cotId,
        participantId,
        request,
      );
      return buildResponse(HttpStatus.OK, result);
    } catch (error) {
      console.log(error);
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @Get('/:certificateId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async get(@Param('certificateId', ParseUUIDPipe) certificateId: string): Promise<any> {
    console.log(certificateId);
    const result = await this.certificateService.getCertificate(certificateId);
    return buildResponse(HttpStatus.OK, result);
  }

  @Get('/:certificateId/view')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async getCertificateFile(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
  ): Promise<WebResponse<string>> {
    const fileBuffer = await this.certificateService.streamFile(certificateId);
    const result = fileBuffer.toString('base64');
    return buildResponse(HttpStatus.OK, result);
  }

  @Delete('/:certificateId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async delete(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
  ): Promise<WebResponse<string>> {
    const result = await this.certificateService.deleteCertificate(certificateId);
    return buildResponse(HttpStatus.OK, result);
  }
}
