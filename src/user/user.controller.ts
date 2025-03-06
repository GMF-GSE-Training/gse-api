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
import { UserService } from './user.service';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from '../model/user.model';
import { AuthGuard } from '../shared/guard/auth.guard';
import { RoleGuard } from '../shared/guard/role.guard';
import { Roles } from '../shared/decorator/role.decorator';
import { CurrentUserRequest } from 'src/model/auth.model';
import { User } from 'src/shared/decorator/user.decorator';

@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles('Super Admin', 'Supervisor', 'LCU')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async create(
    @Body() req: CreateUserRequest,
    @User() user: CurrentUserRequest,
  ): Promise<WebResponse<string>> {
    const result = await this.userService.createUser(req, user);
    return buildResponse(HttpStatus.OK, result);
  }

  @Get('/:userId')
  @Roles('Super Admin', 'Supervisor')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async get(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<WebResponse<UserResponse>> {
    const result = await this.userService.getUser(userId);
    return buildResponse(HttpStatus.OK, result);
  }

  @Patch('/:userId')
  @Roles('Super Admin')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() req: UpdateUserRequest,
    @User() user: CurrentUserRequest,
  ): Promise<WebResponse<string>> {
    const result = await this.userService.updateUser(userId, req, user);
    return buildResponse(HttpStatus.OK, result);
  }

  @Get('/list/result')
  @Roles('Super Admin', 'Supervisor')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async list(
    @User() user: CurrentUserRequest,
    @Query('q') q: string,
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
  ): Promise<WebResponse<UserResponse[]>> {
    const query: ListRequest = {
      searchQuery: q,
      page: page || 1,
      size: size || 10,
    };
    const result = await this.userService.listUsers(query, user);
    return buildResponse(
      HttpStatus.OK,
      result.data,
      null,
      result.actions,
      result.paging,
    );
  }

  @Delete('/:userId')
  @Roles('Super Admin')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(200)
  async deleteUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<WebResponse<string>> {
    const result = await this.userService.delete(userId);
    return buildResponse(HttpStatus.OK, result);
  }
}
