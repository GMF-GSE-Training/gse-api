import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ParticipantCertificateService, CertificateResponse } from './participant-certificate.service';
import { User } from 'src/shared/decorator/user.decorator';
import { CurrentUserRequest } from 'src/model/auth.model';
import { WebResponse, ListRequest, Paging, buildResponse } from 'src/model/web.model';
import { RoleGuard } from 'src/shared/guard/role.guard';
import { AuthGuard } from 'src/shared/guard/auth.guard';
import { Roles } from 'src/shared/decorator/role.decorator';

@Controller('participants')
@UseGuards(AuthGuard, RoleGuard)
export class ParticipantCertificateController {
  constructor(
    private readonly participantCertificateService: ParticipantCertificateService,
  ) {}

  @Get(':participantId/certificates')
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  async listParticipantCertificates(
    @Param('participantId') participantId: string,
    @User() user: CurrentUserRequest,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('q') searchQuery?: string,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: 'asc' | 'desc',
  ): Promise<WebResponse<CertificateResponse[]>> {
    const request: ListRequest = {
      page: page || 1,
      size: size || 10,
      searchQuery,
      sortBy,
      sortOrder,
    };

    const result = await this.participantCertificateService.listParticipantCertificates(
      participantId,
      user,
      request,
    );

    return buildResponse(
      200,
      result.data,
      null,
      null,
      result.paging
    );
  }
}
