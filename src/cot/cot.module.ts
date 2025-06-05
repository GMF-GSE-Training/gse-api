import { Module } from '@nestjs/common';

import { CotController } from './cot.controller.js';
import { CotService } from './cot.service.js';

/**
 *
 */
@Module({
  providers: [CotService],
  controllers: [CotController],
})
export class CotModule {}
