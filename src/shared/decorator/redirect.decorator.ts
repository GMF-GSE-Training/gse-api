import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

export const Redirect = createParamDecorator(
  (data: { url: string }, ctx: ExecutionContext) => {
    const response = ctx.switchToHttp().getResponse();

    if (data && data.url) {
      response.redirect(data.url);
    }

    return null;
  }
);
