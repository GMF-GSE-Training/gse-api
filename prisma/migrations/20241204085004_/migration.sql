/*
  Warnings:

  - You are about to drop the column `qrCodeLink` on the `participants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "qrCodeLink";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "verificationToken" VARCHAR(255);
