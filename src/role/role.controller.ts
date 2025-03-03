import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { Roles } from '../shared/decorator/role.decorator';
import { AuthGuard } from '../shared/guard/auth.guard';
import { RoleGuard } from '../shared/guard/role.guard';
import { RoleResponse } from '../model/role.model';
import { buildResponse, WebResponse } from '../model/web.model';
import { CurrentUserRequest } from 'src/model/auth.model';
import { User } from 'src/shared/decorator/user.decorator';

@Controller('/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @HttpCode(200)
  @Roles('super admin', 'supervisor', 'lcu')
  @UseGuards(AuthGuard, RoleGuard)
  async getAllRoles(
    @User() user: CurrentUserRequest,
  ): Promise<WebResponse<RoleResponse[]>> {
    const result = await this.roleService.getAllRole(user);
    return buildResponse(HttpStatus.OK, result);
  }
}
