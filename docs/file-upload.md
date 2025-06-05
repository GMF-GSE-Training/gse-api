File Upload Module
This module handles file uploads, downloads, and deletions with support for multiple storage providers (local, NAS, GCP, AWS, Alibaba OSS). It includes security features like JWT authentication, rate limiting, and encryption, as well as performance optimizations like streaming uploads and in-memory caching.
Setup

Install Dependencies:
npm install node-cache @nestjs/throttler @nestjs/jwt @nestjs-modules/mailer nodemailer multer-s3 @google-cloud/storage multer-aliyun-oss

Configure .env:Update .env, .env.development, .env.staging, or .env.production with the configurations from .env.example in the root directory.

Database:Ensure your Prisma schema (prisma/schema.prisma) includes Participant and FileMetadata models:
model Participant {
id String @id @default(uuid())
name String
createdAt DateTime @default(now())
files FileMetadata[]
}

model FileMetadata {
id Int @id @default(autoincrement())
path String
fileName String
mimeType String
storageType String
iv String?
isSensitive Boolean
createdAt DateTime @default(now())
participantId String
participant Participant @relation(fields: [participantId], references: [id])
}

Run Migrations:
npx prisma migrate dev

Update App Module:Ensure FileUploadModule is imported in src/app.module.ts:
import { FileUploadModule } from './file-upload/file-upload.module';
@Module({
imports: [FileUploadModule, ...],
})
export class AppModule {}

Features

Streaming Uploads: Uses multer-s3, multer-google-storage, and multer-aliyun-oss for efficient uploads to cloud storage.
Security: JWT authentication (src/shared/guard/jwt-auth.guard.ts), rate limiting, and AES-256-CBC encryption (src/file-upload/workers/encryption.worker.ts).
Performance: In-memory caching with node-cache and async encryption using worker threads.
Error Handling: Fallback to local storage and email notifications via src/mail/mail.service.ts on upload failures.

Troubleshooting

Upload Failures: Verify .env configurations and storage provider credentials.
Authentication Errors: Ensure JWT_SECRET is set and tokens are in Bearer <token> format.
Performance Issues: Monitor cache hit/miss rates in src/file-upload/file-upload.service.ts and adjust TTL if needed.

API Endpoints

POST /file-upload/:participantId/:subfolder: Upload a file (requires JWT).
GET /file-upload/:fileId: Download a file (requires JWT).
DELETE /file-upload/:fileId: Delete a file (requires JWT).

Folder Structure

src/file-upload/: Core module files (file-upload.module.ts, file-upload.controller.ts, file-upload.service.ts).
src/file-upload/providers/: Storage providers (local, AWS, GCP, NAS, Alibaba).
src/file-upload/workers/: Worker threads (encryption.worker.ts).
src/shared/guard/: Authentication guard (jwt-auth.guard.ts).
docs/file-upload.md: This documentation.

Next Steps

Implement client-side encryption using crypto-js in the frontend.
Add Prometheus/Grafana for monitoring (integrate with src/common/service/logger.service.ts).
Configure load balancing and multi-region storage for scalability.
Use sharp for image compression before upload.

See also: Alibaba OSS Documentation

File Upload Module
This module handles file uploads, downloads, and deletions with support for multiple storage providers (local, NAS, GCP, AWS, Alibaba OSS). It includes security features like JWT authentication, rate limiting, and encryption, as well as performance optimizations like streaming uploads and in-memory caching.
Setup

Install Dependencies:
npm install node-cache @nestjs/throttler @nestjs/jwt @nestjs-modules/mailer nodemailer multer-s3 @google-cloud/storage multer-aliyun-oss

Configure .env:Update .env, .env.development, .env.staging, or .env.production with the configurations from .env.example in the root directory.

Database:Ensure your Prisma schema (prisma/schema.prisma) includes Participant and FileMetadata models:
model Participant {
id String @id @default(uuid())
name String
createdAt DateTime @default(now())
files FileMetadata[]
}

model FileMetadata {
id Int @id @default(autoincrement())
path String
fileName String
mimeType String
storageType String
iv String?
isSensitive Boolean
createdAt DateTime @default(now())
participantId String
participant Participant @relation(fields: [participantId], references: [id])
}

Run Migrations:
npx prisma migrate dev

Update App Module:Ensure FileUploadModule is imported in src/app.module.ts:
import { FileUploadModule } from './file-upload/file-upload.module';
@Module({
imports: [FileUploadModule, ...],
})
export class AppModule {}

Features

Streaming Uploads: Handled by MulterModule in file-upload.module.ts using multer-s3, multer-google-storage, and multer-aliyun-oss for efficient uploads to cloud storage.
Security: JWT authentication (src/shared/guard/jwt-auth.guard.ts), rate limiting, and AES-256-CBC encryption (src/file-upload/workers/encryption.worker.ts).
Performance: In-memory caching with node-cache and async encryption using worker threads.
Error Handling: Fallback to local storage and email notifications via src/mail/mail.service.ts on upload failures.

Architecture

file-upload.module.ts: Configures Multer with streaming upload support for all storage providers (local, NAS, AWS, GCP, Alibaba). It uses ConfigService to load credentials and parameters.
file-upload.service.ts: Manages file metadata, encryption, and caching. It uses file.path from Multer for uploads and calls provider methods for downloads/deletions.
providers/: Each provider (local-storage.provider.ts, nas-storage.provider.ts, etc.) handles download and delete operations, while upload is managed by Multer. Providers initialize clients (e.g., AWS.S3, OSS) using environment variables set in file-upload.module.ts.

Troubleshooting

Upload Failures: Verify .env configurations and storage provider credentials in file-upload.module.ts.
Authentication Errors: Ensure JWT_SECRET is set and tokens are in Bearer <token> format.
Performance Issues: Monitor cache hit/miss rates in src/file-upload/file-upload.service.ts and adjust TTL if needed.

API Endpoints

POST /file-upload/:participantId/:subfolder: Upload a file (requires JWT).
GET /file-upload/:fileId: Download a file (requires JWT).
DELETE /file-upload/:fileId: Delete a file (requires JWT).

Folder Structure

src/file-upload/: Core module files (file-upload.module.ts, file-upload.controller.ts, file-upload.service.ts).
src/file-upload/providers/: Storage providers (local, AWS, GCP, NAS, Alibaba).
src/file-upload/workers/: Worker threads (encryption.worker.ts).
src/shared/guard/: Authentication guard (jwt-auth.guard.ts).
docs/file-upload.md: This documentation.

Next Steps

Implement client-side encryption using crypto-js in the frontend.
Add Prometheus/Grafana for monitoring (integrate with src/common/service/logger.service.ts).
Configure load balancing and multi-region storage for scalability.
Use sharp for image compression before upload.

See also: Alibaba OSS Documentation
