import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RoleModule } from './role/role.module';
import { ParticipantModule } from './participant/participant.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CapabilityModule } from './capability/capability.module';
import { CurriculumSyllabusModule } from './curriculum-syllabus/curriculum-syllabus.module';
import { CotModule } from './cot/cot.module';
import { ESignModule } from './e-sign/e-sign.module';
import { ParticipantCotModule } from './participant-cot/participant-cot.module';
import { SharedModule } from './shared/shared.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CertificateModule } from './certificate/certificate.module';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FileUploadModule } from './file-upload/file-upload.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    NestScheduleModule.forRoot(),
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
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: diskStorage({
          destination: './uploads',
          filename: (req, file, cb) => {
            const randomName = Array(32)
              .fill(null)
              .map(() => Math.round(Math.random() * 16).toString(16))
              .join('');
            return cb(null, `${randomName}${extname(file.originalname)}`);
          },
        }),
      }),
      inject: [ConfigService],
    }),
    FileUploadModule,
    // ThrottlerModule.forRoot([
    //   {
    //     ttl: 3600_000, // 1 jam dalam ms
    //     limit: 3, // 3 request per IP per jam
    //   },
    // ]),
  ], 
  controllers: [],
  providers: [
    // HAPUS/COMMENT BARIS INI UNTUK MEMATIKAN THROTTLE GLOBAL
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
    Reflector,
  ],
})
export class AppModule {
  constructor() {
    console.log('Serving static files from:', join(__dirname, '..', 'public'));
  }
}
