import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailModule } from 'src/mail/mail.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    MailModule,
    ThrottlerModule.forRoot([
      {
        ttl: 3600_000, // 1 jam dalam ms
        limit: 3, // 3 request per IP per jam
      },
    ]),
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
