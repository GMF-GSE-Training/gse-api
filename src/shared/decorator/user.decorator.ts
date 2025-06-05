import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { CurrentUserRequest } from '../../model/auth.model.js';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserRequest => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);
