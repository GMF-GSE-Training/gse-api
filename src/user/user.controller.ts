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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ZodValidationPipe } from '../common/pipe/zod-validation.pipe.js';
import type { CurrentUserRequest } from '../model/auth.model.js';
import { UserResponse } from '../model/user.model.js';
import { buildResponse, ListRequest, WebResponse } from '../model/web.model.js';
import { Roles } from '../shared/decorator/role.decorator.js';
import { User } from '../shared/decorator/user.decorator.js';
import { AuthGuard } from '../shared/guard/auth.guard.js';
import { RoleGuard } from '../shared/guard/role.guard.js';

import { CreateUserSchema, UpdateUserSchema, CreateUserDtoClass } from './dto/user.dto.js';
import type { CreateUserDto, UpdateUserDto } from './dto/user.dto.js';
import { UserService } from './user.service.js';

/**
 * Controller untuk mengelola pengguna.
 */
@ApiTags('Users')
@Controller('/users')
export class UserController {
  /**
   *
   * @param userService
   */
  constructor(private readonly userService: UserService) {}

  /**
   *
   * @param req
   * @param user
   */
  @Post()
  @Roles('Super Admin', 'Supervisor', 'LCU')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Membuat pengguna baru' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User berhasil dibuat' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Data tidak valid',
  })
  @ApiBearerAuth()
  async create(
    @Body(new ZodValidationPipe(CreateUserSchema)) req: CreateUserDto,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const result = await this.userService.createUser(req, user);
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param userId
   */
  @Get('/:userId')
  @Roles('Super Admin', 'Supervisor')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mengambil data pengguna berdasarkan ID' })
  @ApiResponse({ status: HttpStatus.OK, type: CreateUserDtoClass })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User tidak ditemukan',
  })
  @ApiBearerAuth()
  async get(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<WebResponse<UserResponse>> {
    const result = await this.userService.getUser(userId);
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param userId
   * @param req
   * @param user
   */
  @Patch('/:userId')
  @Roles('Super Admin')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Memperbarui data pengguna' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User berhasil diperbarui',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Data tidak valid',
  })
  @ApiBearerAuth()
  async update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) req: UpdateUserDto,
    @User() user: CurrentUserRequest
  ): Promise<WebResponse<string>> {
    const result = await this.userService.updateUser(userId, req, user);
    return buildResponse(HttpStatus.OK, result);
  }

  /**
   *
   * @param user
   * @param q
   * @param page
   * @param size
   */
  @Get('/list/result')
  @Roles('Super Admin', 'Supervisor')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mengambil daftar pengguna dengan paginasi' })
  @ApiResponse({ status: HttpStatus.OK, type: [CreateUserDtoClass] })
  @ApiBearerAuth()
  async list(
    @User() user: CurrentUserRequest,
    @Query('q') q: string,
    @Query(
      'page',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException(
            'Page harus berupa angka positif',
            HttpStatus.BAD_REQUEST
          ),
      })
    )
    page?: number,
    @Query(
      'size',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new HttpException(
            'Size harus berupa angka positif',
            HttpStatus.BAD_REQUEST
          ),
      })
    )
    size?: number
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
      undefined,
      result.actions,
      result.paging
    );
  }

  /**
   *
   * @param userId
   */
  @Delete('/:userId')
  @Roles('Super Admin')
  @UseGuards(AuthGuard, RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Menghapus pengguna berdasarkan ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User berhasil dihapus' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User tidak ditemukan',
  })
  @ApiBearerAuth()
  async deleteUser(
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<WebResponse<string>> {
    const result = await this.userService.delete(userId);
    return buildResponse(HttpStatus.OK, result);
  }
}