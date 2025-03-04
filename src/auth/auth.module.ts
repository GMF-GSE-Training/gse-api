import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
