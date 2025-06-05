/*
  Warnings:

  - You are about to drop the column `qrCodeFrontendUrl` on the `participants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "qrCodeFrontendUrl";

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "frontendUrl" TEXT NOT NULL,
    "backendUrl" TEXT NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);
