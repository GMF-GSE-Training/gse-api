import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RoleModule } from './role/role.module';
import { ParticipantModule } from './participant/participant.module';
import { ConfigModule } from '@nestjs/config';
import { CapabilityModule } from './capability/capability.module';
import { CurriculumSyllabusModule } from './curriculum-syllabus/curriculum-syllabus.module';
import { CotModule } from './cot/cot.module';
import { ESignModule } from './e-sign/e-sign.module';
import { ParticipantCotModule } from './participant-cot/participant-cot.module';
import { SharedModule } from './shared/shared.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CertificateModule } from './certificate/certificate.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // Mengarah ke folder 'public' di root proyek
    }),
    CommonModule,
    SharedModule,
    UserModule,
    AuthModule,
    RoleModule,
    ParticipantModule,
    CapabilityModule,
    CurriculumSyllabusModule,
    CotModule,
    ParticipantCotModule,
    ESignModule,
    CertificateModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor() {
    console.log('Serving static files from:', join(__dirname, '..', 'public'));
  }
}
