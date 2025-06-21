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

import { CurrentUserRequest } from '../model/auth.model.js';
import { CotResponse, CreateCot, UpdateCot } from '../model/cot.model.js';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import { CotService } from './cot.service.js';

/**
 *
 */
@Controller('/cot')
export class CotController {
  /**
   *
   * @param cotService
   */
  constructor(private readonly cotService: CotService) {}

  /**
   *
   * @param request
   */
  @Post()
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async create(@Body() request: CreateCot): Promise<WebResponse<string>> {
    const result = await this.cotService.createCot(request);
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param user
   * @param q
   * @param page
   * @param size
   * @param startDate
   * @param endDate
   */
  @Get('/list')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async list(
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
    size?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<WebResponse<CotResponse[]>> {
    const validateDate = (dateStr: string) => {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new HttpException(`Invalid date format: ${dateStr}`, 400);
      }
      return date;
    };

    const query: ListRequest = {
      search: q,
      page: page || 1,
      size: size || 10,
      startDate: startDate ? validateDate(startDate) : undefined,
      endDate: endDate ? validateDate(endDate) : undefined,
    };
    const result = await this.cotService.listCot(query, user);
    return buildResponse(result.data, undefined, 'success');
  }

  /**
   *
   * @param user
   * @param cotId
   */
  @Get('/:cotId')
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu', 'user')
  @UseGuards(AuthGuard, RoleGuard)
  async get(
    @User() user: CurrentUserRequest,
    @Param('cotId', ParseUUIDPipe) cotId: string
  ): Promise<WebResponse<CotResponse>> {
    const result = await this.cotService.getCot(cotId, user);
    return buildResponse(result, undefined, 'success');
  }

  /**
   *
   * @param cotId
   * @param request
   */
  @Patch('/:cotId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async update(
    @Param('cotId', ParseUUIDPipe) cotId: string,
    @Body() request: UpdateCot
  ): Promise<WebResponse<string>> {
    request.startDate = request.startDate
      ? new Date(request.startDate)
      : undefined;
    request.endDate = request.endDate ? new Date(request.endDate) : undefined;
    const result = await this.cotService.updateCot(cotId, request);
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param cotId
   */
  @Delete('/:cotId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async delete(
    @Param('cotId', ParseUUIDPipe) cotId: string
  ): Promise<WebResponse<string>> {
    const result = await this.cotService.deleteCot(cotId);
    return buildResponse(HttpStatus.OK, result);
  }
}
