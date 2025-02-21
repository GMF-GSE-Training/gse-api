import { Module } from '@nestjs/common';
import { CapabilityService } from './capability.service';
import { CapabilityController } from './capability.controller';

@Module({
  providers: [CapabilityService],
  controllers: [CapabilityController],
})
export class CapabilityModule {}
