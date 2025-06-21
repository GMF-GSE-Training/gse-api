import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { CurrentUserRequest } from '../model/auth.model.js';
import { RoleResponse } from '../model/role.model.js';
import { buildResponse, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import { RoleService } from './role.service.js';

/**
 *
 */
@Controller('/roles')
export class RoleController {
  /**
   *
   * @param roleService
   */
  constructor(private readonly roleService: RoleService) {}

  /**
   *
   * @param user
   */
  @Get()
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async getAllRoles(
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<RoleResponse[]>> {
    const result = await this.roleService.getAllRole(user);
    return buildResponse(result, undefined, 'success');
  }
}
