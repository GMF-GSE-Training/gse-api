/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `participants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "qrCodeFrontendUrl" TEXT,
ADD COLUMN     "qrCodeLink" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "participants_email_key" ON "participants"("email");
