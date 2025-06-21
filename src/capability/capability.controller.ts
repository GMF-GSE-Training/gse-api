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
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { CurrentUserRequest } from '../model/auth.model.js';
import type {
  CapabilityResponse,
  CreateCapability,
  UpdateCapability,
} from '../model/capability.model.js';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import { CapabilityService } from './capability.service.js';

/**
 *
 */
@Controller('/capability')
export class CapabilityController {
  /**
   *
   * @param capabilityService
   */
  constructor(private readonly capabilityService: CapabilityService) {}

  /**
   *
   * @param request
   */
  @Post()
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async create(
    @Body() request: CreateCapability
  ): Promise<WebResponse<CapabilityResponse>> {
    const result = await this.capabilityService.createCapability(request);
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param capabilityId
   */
  @Get('/:capabilityId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async get(
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string
  ): Promise<WebResponse<CapabilityResponse>> {
    const result = await this.capabilityService.getCapabilityById(capabilityId);
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param capabilityId
   */
  @Get('/:capabilityId/curriculum-syllabus')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async getCurriculumSyllabus(
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string
  ): Promise<WebResponse<CapabilityResponse>> {
    const result =
      await this.capabilityService.getCurriculumSyllabus(capabilityId);
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param capabilityId
   * @param req
   */
  @Patch('/:capabilityId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async update(
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string,
    @Body() req: UpdateCapability
  ): Promise<WebResponse<string>> {
    const result = await this.capabilityService.updateCapability(
      capabilityId,
      req
    );
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param capabilityId
   */
  @Delete('/:capabilityId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async delete(
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string
  ): Promise<WebResponse<string>> {
    const result = await this.capabilityService.deleteCapability(capabilityId);
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   */
  @Get()
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async getAll(): Promise<WebResponse<CapabilityResponse[]>> {
    const result = await this.capabilityService.getAllCapability();
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param user
   * @param q
   * @param page
   * @param size
   */
  @Get('/list/result')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async list(
    @User() user: CurrentUserRequest,
    @Query('q') q: string,
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
  ): Promise<WebResponse<CapabilityResponse[]>> {
    const query: ListRequest = {
      search: q,
      page: page || 1,
      size: size || 10,
    };
    const result = await this.capabilityService.listCapability(user, query);
    return buildResponse(
      result.data,
      undefined,
      'success',
      result.actions,
      result.paging
    );
  }
}
