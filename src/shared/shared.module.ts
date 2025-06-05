import { Global, Module } from '@nestjs/common';

import { AuthGuard } from './guard/auth.guard.js';
import { RoleGuard } from './guard/role.guard.js';

/**
 * Modul global untuk menyediakan guard autentikasi dan otorisasi.
 * @description Mengekspor AuthGuard dan RoleGuard untuk penggunaan di seluruh aplikasi.
 */
@Global()
@Module({
  providers: [AuthGuard, RoleGuard],
  exports: [AuthGuard, RoleGuard],
})
export class SharedModule {}
