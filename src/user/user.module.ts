import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CoreHelper } from '../common/helpers/core.helper.js';
import { ValidationService } from '../common/service/validation.service.js';

import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

/**
 *
 */
@Module({
  imports: [ConfigModule],
  providers: [UserService, ValidationService, CoreHelper],
  controllers: [UserController],
})
export class UserModule {}
