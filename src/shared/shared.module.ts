import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './guard/auth.guard';
import { RoleGuard } from './guard/role.guard';

@Global()
@Module({
  providers: [AuthGuard, RoleGuard],
  exports: [AuthGuard, RoleGuard],
})
export class SharedModule {}
