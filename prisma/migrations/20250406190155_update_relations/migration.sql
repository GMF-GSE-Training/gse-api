/*
  Warnings:

  - You are about to drop the column `foto` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `ktp` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `qrCode` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simA` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simB` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratBebasNarkoba` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratSehatButaWarna` on the `participants` table. All the data in the column will be lost.
  - You are about to alter the column `qrCodeLink` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to drop the column `eSign` on the `signatures` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[simAId]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[simBId]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ktpId]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fotoId]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[suratSehatButaWarnaId]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[suratBebasNarkobaId]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qrCodeId]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[eSignId]` on the table `signatures` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "foto",
DROP COLUMN "ktp",
DROP COLUMN "qrCode",
DROP COLUMN "simA",
DROP COLUMN "simB",
DROP COLUMN "suratBebasNarkoba",
DROP COLUMN "suratSehatButaWarna",
ADD COLUMN     "fotoId" INTEGER,
ADD COLUMN     "ktpId" INTEGER,
ADD COLUMN     "qrCodeId" INTEGER,
ADD COLUMN     "simAId" INTEGER,
ADD COLUMN     "simBId" INTEGER,
ADD COLUMN     "suratBebasNarkobaId" INTEGER,
ADD COLUMN     "suratSehatButaWarnaId" INTEGER,
ALTER COLUMN "qrCodeLink" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "signatures" DROP COLUMN "eSign",
ADD COLUMN     "eSignId" INTEGER;

-- CreateTable
CREATE TABLE "file_metadata" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageType" TEXT NOT NULL,
    "iv" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_path_key" ON "file_metadata"("path");

-- CreateIndex
CREATE UNIQUE INDEX "participants_simAId_key" ON "participants"("simAId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_simBId_key" ON "participants"("simBId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_ktpId_key" ON "participants"("ktpId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_fotoId_key" ON "participants"("fotoId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_suratSehatButaWarnaId_key" ON "participants"("suratSehatButaWarnaId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_suratBebasNarkobaId_key" ON "participants"("suratBebasNarkobaId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_qrCodeId_key" ON "participants"("qrCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_eSignId_key" ON "signatures"("eSignId");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_simAId_fkey" FOREIGN KEY ("simAId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_simBId_fkey" FOREIGN KEY ("simBId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_ktpId_fkey" FOREIGN KEY ("ktpId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_suratSehatButaWarnaId_fkey" FOREIGN KEY ("suratSehatButaWarnaId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_suratBebasNarkobaId_fkey" FOREIGN KEY ("suratBebasNarkobaId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_eSignId_fkey" FOREIGN KEY ("eSignId") REFERENCES "file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;
