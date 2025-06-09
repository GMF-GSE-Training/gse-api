/*
  Warnings:

  - You are about to drop the column `verificationToken` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "verificationToken",
ADD COLUMN     "accountVerificationToken" VARCHAR(255),
ADD COLUMN     "emailChangeToken" VARCHAR(255),
ADD COLUMN     "passwordResetToken" VARCHAR(255);
