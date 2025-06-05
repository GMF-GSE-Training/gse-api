import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  CreateCurriculumSyllabus,
  UpdateCurriculumSyllabus,
} from '../model/curriculum-syllabus.model.js';
import { buildResponse, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import { CurriculumSyllabusService } from './curriculum-syllabus.service.js';

/**
 *
 */
@Controller('/curriculum-syllabus')
export class CurriculumSyllabusController {
  /**
   *
   * @param curriculumSyllabusService
   */
  constructor(
    private readonly curriculumSyllabusService: CurriculumSyllabusService
  ) {}

  /**
   *
   * @param request
   */
  @Post()
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async create(
    @Body() request: CreateCurriculumSyllabus
  ): Promise<WebResponse<string>> {
    const result =
      await this.curriculumSyllabusService.createCurriculumSyllabus(request);
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param capabilityId
   * @param request
   */
  @Patch('/:capabilityId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async update(
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string,
    @Body() request: UpdateCurriculumSyllabus
  ): Promise<WebResponse<string>> {
    const result =
      await this.curriculumSyllabusService.updateCurriculumSyllabus(
        capabilityId,
        request
      );
    return buildResponse(HttpStatus.OK, result);
  }
}
