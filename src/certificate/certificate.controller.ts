import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { Roles } from 'src/shared/decorator/role.decorator';
import { AuthGuard } from 'src/shared/guard/auth.guard';
import { RoleGuard } from 'src/shared/guard/role.guard';
import { CertificateListResponse, CreateCertificate, UpdateCertificate } from 'src/model/certificate.model';
import { buildResponse, ListRequest, WebResponse } from 'src/model/web.model';
import { CurrentUserRequest } from 'src/model/auth.model';
import { User } from 'src/shared/decorator/user.decorator';
import { Public } from 'src/auth/public.decorator';

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

  @Get('/list/result')
  @Public()
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async list(
    @User() user?: CurrentUserRequest,
    @Query('q') q?: string,
    @Query(
      'page',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Page must be a positive number', 400),
      }),
    )
    page?: number,
    @Query(
      'size',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Size must be a positive number', 400),
      }),
    )
    size?: number,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: string,
  ): Promise<WebResponse<CertificateListResponse[]>> {
    const query: ListRequest = {
      searchQuery: q,
      page: page || 1,
      size: size || 10,
      sortBy: sortBy || 'expDate',
      sortOrder: sortOrder === 'desc' ? 'desc' : 'asc',
    };
    const result = await this.certificateService.listCertificates(query, user || null);
    return buildResponse(
      HttpStatus.OK,
      result.data,
      null,
      result.actions,
      result.paging,
    );
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
  @Public()
  async getCertificateFile(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
  ): Promise<WebResponse<string>> {
    const result = await this.certificateService.getCertificateFile(certificateId);
    return buildResponse(HttpStatus.OK, result);
  }

  @Put('/:certificateId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async update(
    @Param('certificateId', ParseUUIDPipe) certificateId: string,
    @Body() request: UpdateCertificate,
  ): Promise<WebResponse<string>> {
    try {
      const result = await this.certificateService.updateCertificate(certificateId, request);
      return buildResponse(HttpStatus.OK, result);
    } catch (error) {
      console.log(error);
      throw new HttpException(error.message, error.status || 500);
    }
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
