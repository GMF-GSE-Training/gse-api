import { Module } from '@nestjs/common';

import { CapabilityController } from './capability.controller.js';
import { CapabilityService } from './capability.service.js';

/**
 *
 */
@Module({
  providers: [CapabilityService],
  controllers: [CapabilityController],
})
export class CapabilityModule {}
