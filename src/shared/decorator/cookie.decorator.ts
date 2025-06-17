import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const SetCookie = createParamDecorator(
  (
    data: { name: string; value: string; options?: any },
    ctx: ExecutionContext,
  ) => {
    const response = ctx.switchToHttp().getResponse();

    if (data) {
      const isProduction = process.env.NODE_ENV === 'production';
      response.cookie(data.name, data.value, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24,
        ...data.options,
      });
    }

    return null;
  },
);

export const GetCookie = createParamDecorator(
  (cookieName: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    if (cookieName) {
      return request.cookies?.[cookieName] || null;
    }

    return request.cookies || {};
  },
);

export const ClearCookie = createParamDecorator(
  (
    data: { name: string; value: string; options?: any },
    ctx: ExecutionContext,
  ) => {
    const response = ctx.switchToHttp().getResponse();

    if (data) {
      response.clearCookie(data.name);
    }

    return null;
  },
);
