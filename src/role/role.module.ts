import { Module } from '@nestjs/common';

import { RoleController } from './role.controller.js';
import { RoleService } from './role.service.js';

/**
 *
 */
@Module({
  providers: [RoleService],
  controllers: [RoleController],
})
export class RoleModule {}
