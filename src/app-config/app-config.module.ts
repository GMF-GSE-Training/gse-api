import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../common/service/app-config.service.js';

/**
 *
 */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
