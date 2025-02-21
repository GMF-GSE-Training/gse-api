import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const Roles = (...roles: Role['name'][]) => SetMetadata('roles', roles);
