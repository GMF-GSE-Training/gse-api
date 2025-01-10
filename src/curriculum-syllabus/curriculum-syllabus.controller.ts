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
import { CurriculumSyllabusService } from './curriculum-syllabus.service';
import {
  CreateCurriculumSyllabus,
  UpdateCurriculumSyllabus,
} from 'src/model/curriculum-syllabus.model';
import { buildResponse, WebResponse } from 'src/model/web.model';
import { Roles } from 'src/shared/decorator/role.decorator';
import { AuthGuard } from 'src/shared/guard/auth.guard';
import { RoleGuard } from 'src/shared/guard/role.guard';

@Controller('/curriculum-syllabus')
export class CurriculumSyllabusController {
  constructor(
    private readonly curriculumSyllabusService: CurriculumSyllabusService,
  ) {}

  @Post()
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async create(
    @Body() request: CreateCurriculumSyllabus,
  ): Promise<WebResponse<string>> {
    const result =
      await this.curriculumSyllabusService.createCurriculumSyllabus(request);
    return buildResponse(HttpStatus.OK, result);
  }

  @Patch('/:capabilityId')
  @HttpCode(200)
  @Roles('super admin')
  @UseGuards(AuthGuard, RoleGuard)
  async update(
    @Param('capabilityId', ParseUUIDPipe) capabilityId: string,
    @Body() request: UpdateCurriculumSyllabus,
  ): Promise<WebResponse<string>> {
    const result =
      await this.curriculumSyllabusService.updateCurriculumSyllabus(
        capabilityId,
        request,
      );
    return buildResponse(HttpStatus.OK, result);
  }
}
