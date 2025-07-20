import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CotResponse, CreateCot, UpdateCot } from "src/model/cot.model";
import { buildResponse, ListRequest, WebResponse } from "src/model/web.model";
import { CotService } from "./cot.service";
import { Roles } from "src/shared/decorator/role.decorator";
import { AuthGuard } from "src/shared/guard/auth.guard";
import { RoleGuard } from "src/shared/guard/role.guard";
import { CurrentUserRequest } from "src/model/auth.model";
import { User } from "src/shared/decorator/user.decorator";

@Controller('/cot')
export class CotController {
    constructor(private readonly cotService: CotService) { }

    @Post()
    @HttpCode(200)
    @Roles('super admin')
    @UseGuards(AuthGuard, RoleGuard)
    async create(@Body() request: CreateCot): Promise<WebResponse<string>> {
        const result = await this.cotService.createCot(request);
        return buildResponse(HttpStatus.OK, result);
    }

    @Get('/list')
    @HttpCode(200)
    @Roles('super admin', 'supervisor', 'lcu', 'user')
    @UseGuards(AuthGuard, RoleGuard)

    async list(
        @User() user: CurrentUserRequest,
        @Query('q') q?: string,
        @Query('page', new ParseIntPipe({ optional: true, exceptionFactory: () => new HttpException('Page must be a positive number', 400) })) page?: number,
        @Query('size', new ParseIntPipe({ optional: true, exceptionFactory: () => new HttpException('Size must be a positive number', 400) })) size?: number,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('sort_by') sortBy?: string,
        @Query('sort_order') sortOrder?: 'asc' | 'desc',
    ): Promise<WebResponse<CotResponse[]>> {
        const validateDate = (dateStr: string) => {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                throw new HttpException(`Invalid date format: ${dateStr}`, 400);
            }
            return date;
        };

        const query: ListRequest = { 
            searchQuery: q,
            page: page || 1,
            size: size || 10,
            startDate: startDate ? validateDate(startDate) : undefined,
            endDate: endDate ? validateDate(endDate) : undefined,
            sortBy: sortBy || 'startDate',
            sortOrder: sortOrder || 'asc',
        };
        const result = await this.cotService.listCot(query, user);
        return buildResponse(HttpStatus.OK, result.data, null, result.actions, result.paging);
    }

    @Get('/:cotId')
    @HttpCode(200)
    @Roles('super admin', 'supervisor', 'lcu', 'user')
    @UseGuards(AuthGuard, RoleGuard)
    async get(@User() user: CurrentUserRequest, @Param('cotId', ParseUUIDPipe) cotId: string): Promise<WebResponse<CotResponse>> {
        const result = await this.cotService.getCot(cotId, user);
        return buildResponse(HttpStatus.OK, result);
    }

    @Patch('/:cotId')
    @HttpCode(200)
    @Roles('super admin')
    @UseGuards(AuthGuard, RoleGuard)
    async update(@Param('cotId', ParseUUIDPipe) cotId: string, @Body() request: UpdateCot): Promise<WebResponse<string>> {
        request.startDate =  request.startDate ? new Date(request.startDate) : undefined;
        request.endDate =  request.endDate ? new Date(request.endDate) : undefined;
        const result = await this.cotService.updateCot(cotId, request);
        return buildResponse(HttpStatus.OK, result);
    }

    @Delete('/:cotId')
    @HttpCode(200)
    @Roles('super admin')
    @UseGuards(AuthGuard, RoleGuard)
    async delete(@Param('cotId', ParseUUIDPipe) cotId: string): Promise<WebResponse<string>> {
        const result = await this.cotService.deleteCot(cotId);
        return buildResponse(HttpStatus.OK, result);
    }
}