import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

export const SetCookie = createParamDecorator(
  (
    data: { name: string; value: string; options?: any },
    ctx: ExecutionContext
  ) => {
    const response = ctx.switchToHttp().getResponse();

    if (data) {
      response.cookie(data.name, data.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24,
        ...data.options,
      });
    }

    return null;
  }
);

export const GetCookie = createParamDecorator(
  (cookieName: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (cookieName) {
      return request.cookies?.[cookieName] || null;
    }

    return request.cookies || {};
  }
);

export const ClearCookie = createParamDecorator(
  (
    data: { name: string; value: string; options?: any },
    ctx: ExecutionContext
  ) => {
    const response = ctx.switchToHttp().getResponse();

    if (data) {
      response.clearCookie(data.name);
    }

    return null;
  }
);
