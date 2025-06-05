/*
  Warnings:

  - You are about to drop the column `fotoId` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `ktpId` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `qrCodeId` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simAId` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simBId` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratBebasNarkobaId` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratSehatButaWarnaId` on the `participants` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[participantSimAId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participantSimBId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participantKtpId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participantFotoId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participantSuratSehatButaWarnaId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participantSuratBebasNarkobaId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[participantQrCodeId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fileSize` to the `file_metadata` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_fotoId_fkey";

-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_ktpId_fkey";

-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_qrCodeId_fkey";

-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_simAId_fkey";

-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_simBId_fkey";

-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_suratBebasNarkobaId_fkey";

-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_suratSehatButaWarnaId_fkey";

-- DropIndex
DROP INDEX "participants_fotoId_key";

-- DropIndex
DROP INDEX "participants_ktpId_key";

-- DropIndex
DROP INDEX "participants_qrCodeId_key";

-- DropIndex
DROP INDEX "participants_simAId_key";

-- DropIndex
DROP INDEX "participants_simBId_key";

-- DropIndex
DROP INDEX "participants_suratBebasNarkobaId_key";

-- DropIndex
DROP INDEX "participants_suratSehatButaWarnaId_key";

-- AlterTable
ALTER TABLE "file_metadata" ADD COLUMN     "fileSize" INTEGER NOT NULL,
ADD COLUMN     "participantFotoId" TEXT,
ADD COLUMN     "participantKtpId" TEXT,
ADD COLUMN     "participantQrCodeId" TEXT,
ADD COLUMN     "participantSimAId" TEXT,
ADD COLUMN     "participantSimBId" TEXT,
ADD COLUMN     "participantSuratBebasNarkobaId" TEXT,
ADD COLUMN     "participantSuratSehatButaWarnaId" TEXT;

-- AlterTable
ALTER TABLE "participants" DROP COLUMN "fotoId",
DROP COLUMN "ktpId",
DROP COLUMN "qrCodeId",
DROP COLUMN "simAId",
DROP COLUMN "simBId",
DROP COLUMN "suratBebasNarkobaId",
DROP COLUMN "suratSehatButaWarnaId";

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantSimAId_key" ON "file_metadata"("participantSimAId");

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantSimBId_key" ON "file_metadata"("participantSimBId");

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantKtpId_key" ON "file_metadata"("participantKtpId");

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantFotoId_key" ON "file_metadata"("participantFotoId");

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantSuratSehatButaWarnaId_key" ON "file_metadata"("participantSuratSehatButaWarnaId");

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantSuratBebasNarkobaId_key" ON "file_metadata"("participantSuratBebasNarkobaId");

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantQrCodeId_key" ON "file_metadata"("participantQrCodeId");

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantSimAId_fkey" FOREIGN KEY ("participantSimAId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantSimBId_fkey" FOREIGN KEY ("participantSimBId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantKtpId_fkey" FOREIGN KEY ("participantKtpId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantFotoId_fkey" FOREIGN KEY ("participantFotoId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantSuratSehatButaWarnaId_fkey" FOREIGN KEY ("participantSuratSehatButaWarnaId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantSuratBebasNarkobaId_fkey" FOREIGN KEY ("participantSuratBebasNarkobaId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantQrCodeId_fkey" FOREIGN KEY ("participantQrCodeId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
