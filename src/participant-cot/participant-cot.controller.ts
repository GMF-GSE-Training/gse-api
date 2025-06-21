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
  Query,
  UseGuards,
} from '@nestjs/common';

import type { CurrentUserRequest } from '../model/auth.model.js';
import type {
  AddParticipantToCot,
  ParticipantCotResponse,
  AddParticipantResponse,
} from '../model/participant-cot.model.js';
import { ListParticipantResponse } from '../model/participant.model.js';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import { ParticipantCotService } from './participant-cot.service.js';

/**
 *
 */
@Controller('/participant-cot')
export class ParticipantCotController {
  /**
   *
   * @param participantCotService
   */
  constructor(private readonly participantCotService: ParticipantCotService) {}

  /**
   *
   * @param cotId
   * @param user
   * @param q
   * @param page
   * @param size
   */
  @Get('unregistered/:cotId')
  @HttpCode(200)
  @Roles('super admin', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async getUnregisteredParticipants(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @User() user: CurrentUserRequest,
    @Query('q') q?: string,
    @Query(
      'page',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Page must be a positive number', 400),
      })
    )
    page?: number,
    @Query(
      'size',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Size must be a positive number', 400),
      })
    )
    size?: number
  ): Promise<WebResponse<ListParticipantResponse[]>> {
    const query: ListRequest = {
      search: q,
      page: page || 1,
      size: size || 10,
    };

    const result = await this.participantCotService.getUnregisteredParticipants(
      cotId,
      user,
      query
    );
    return buildResponse(
      HttpStatus.OK,
      result.data,
      undefined,
      undefined,
      result.paging
    );
  }

  /**
   *
   * @param cotId
   * @param user
   * @param request
   */
  @Post('/:cotId')
  @HttpCode(200)
  @Roles('super admin', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async addParticipantToCot(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @User() user: CurrentUserRequest,
    @Body() request: AddParticipantToCot
  ): Promise<WebResponse<AddParticipantResponse>> {
    const result = await this.participantCotService.addParticipantToCot(
      cotId,
      user,
      request
    );
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param cotId
   * @param participantId
   */
  @Delete('/:cotId/:participantId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async deleteParticipantFromCot(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string
  ): Promise<WebResponse<string>> {
    const result = await this.participantCotService.deleteParticipantFromCot(
      participantId,
      cotId
    );
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param cotId
   * @param user
   * @param q
   * @param page
   * @param size
   */
  @Get('/:cotId/list/result')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async listParticipantCot(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @User() user: CurrentUserRequest,
    @Query('q') q?: string,
    @Query(
      'page',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Page must be a positive number', 400),
      })
    )
    page?: number,
    @Query(
      'size',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException('Size must be a positive number', 400),
      })
    )
    size?: number
  ): Promise<WebResponse<ParticipantCotResponse>> {
    const query: ListRequest = {
      search: q,
      page: page || 1,
      size: size || 10,
    };
    const result = await this.participantCotService.listParticipantsCot(
      cotId,
      user,
      query
    );
    return buildResponse(HttpStatus.OK, result);
  }
}
