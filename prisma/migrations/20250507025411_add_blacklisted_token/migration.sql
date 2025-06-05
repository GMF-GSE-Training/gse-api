/*
  Warnings:

  - The `oauthProvider` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `hashAlgorithm` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- AlterTable
ALTER TABLE "participants" ALTER COLUMN "dinas" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "dinas" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "hashAlgorithm" SET NOT NULL,
ALTER COLUMN "hashAlgorithm" SET DEFAULT 'argon2id',
DROP COLUMN "oauthProvider",
ADD COLUMN     "oauthProvider" "OAuthProvider";

-- CreateIndex
CREATE INDEX "users_oauthId_oauthProvider_idx" ON "users"("oauthId", "oauthProvider");

-- CreateIndex
CREATE INDEX "users_passwordResetToken_idx" ON "users"("passwordResetToken");

-- CreateIndex
CREATE INDEX "users_updateEmailToken_idx" ON "users"("updateEmailToken");
