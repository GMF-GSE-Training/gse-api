/*
  Warnings:

  - You are about to drop the column `timestamp` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to alter the column `action` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `mimeType` on the `file_metadata` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `storageType` on the `file_metadata` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `fileName` on the `file_metadata` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to drop the column `emailChangeToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `AppConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `capabilityCots` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `curriculumSyllabus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `participantsCot` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `capabilities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `roles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "capabilityCots" DROP CONSTRAINT "capabilityCots_capabilityId_fkey";

-- DropForeignKey
ALTER TABLE "capabilityCots" DROP CONSTRAINT "capabilityCots_cotId_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_cotId_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_participantId_fkey";

-- DropForeignKey
ALTER TABLE "curriculumSyllabus" DROP CONSTRAINT "curriculumSyllabus_capabilityId_fkey";

-- DropForeignKey
ALTER TABLE "participantsCot" DROP CONSTRAINT "participantsCot_cotId_fkey";

-- DropForeignKey
ALTER TABLE "participantsCot" DROP CONSTRAINT "participantsCot_participantId_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_userId_fkey";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "timestamp",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "action" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "capabilities" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "cots" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "file_metadata" ALTER COLUMN "mimeType" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "storageType" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "fileName" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "participants" ALTER COLUMN "qrCodeLink" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailChangeToken",
DROP COLUMN "refreshToken",
ADD COLUMN     "hashAlgorithm" VARCHAR(50) DEFAULT 'argon2',
ADD COLUMN     "lockUntil" TIMESTAMP(3),
ADD COLUMN     "loginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "oauthId" VARCHAR(255),
ADD COLUMN     "oauthProvider" VARCHAR(50),
ADD COLUMN     "verificationSentAt" TIMESTAMP(3),
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "accountVerificationToken" SET DATA TYPE TEXT,
ALTER COLUMN "passwordResetToken" SET DATA TYPE TEXT,
ALTER COLUMN "updateEmailToken" SET DATA TYPE TEXT,
ALTER COLUMN "twoFactorSecret" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "AppConfig";

-- DropTable
DROP TABLE "capabilityCots";

-- DropTable
DROP TABLE "curriculumSyllabus";

-- DropTable
DROP TABLE "participantsCot";

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "state" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_configs" (
    "id" TEXT NOT NULL,
    "frontendUrl" TEXT NOT NULL,
    "backendUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_syllabus" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "theoryDuration" INTEGER NOT NULL,
    "practiceDuration" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_cots" (
    "capabilityId" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,

    CONSTRAINT "capability_cots_pkey" PRIMARY KEY ("capabilityId","cotId")
);

-- CreateTable
CREATE TABLE "participants_cot" (
    "id" TEXT NOT NULL,
    "participantId" TEXT,
    "cotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participants_cot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_key" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "oauth_states_state_idx" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "participants_idNumber_idx" ON "participants"("idNumber");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_idNumber_idx" ON "users"("idNumber");

-- CreateIndex
CREATE INDEX "users_oauthId_oauthProvider_idx" ON "users"("oauthId", "oauthProvider");

-- CreateIndex
CREATE INDEX "users_accountVerificationToken_idx" ON "users"("accountVerificationToken");

-- AddForeignKey
ALTER TABLE "curriculum_syllabus" ADD CONSTRAINT "curriculum_syllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_cots" ADD CONSTRAINT "capability_cots_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_cots" ADD CONSTRAINT "capability_cots_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "cots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants_cot" ADD CONSTRAINT "participants_cot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants_cot" ADD CONSTRAINT "participants_cot_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "cots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "cots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
