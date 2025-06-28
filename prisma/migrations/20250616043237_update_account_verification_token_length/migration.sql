/*
  Warnings:

  - You are about to alter the column `accountVerificationToken` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(512)`.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "accountVerificationToken" SET DATA TYPE VARCHAR(512);
