import { Module } from '@nestjs/common';
import { ESignService } from './e-sign.service';
import { ESignController } from './e-sign.controller';

@Module({
  providers: [ESignService],
  controllers: [ESignController],
})
export class ESignModule {}
