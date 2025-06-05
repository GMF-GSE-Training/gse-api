/*
  Warnings:

  - You are about to drop the column `eSignFileName` on the `signatures` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idNumber]` on the table `signatures` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "file_metadata" ADD COLUMN     "fileName" TEXT,
ALTER COLUMN "isSensitive" SET DEFAULT true;

-- AlterTable
ALTER TABLE "signatures" DROP COLUMN "eSignFileName";

-- CreateIndex
CREATE INDEX "participants_email_idx" ON "participants"("email");

-- CreateIndex
CREATE INDEX "participants_nik_idx" ON "participants"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_idNumber_key" ON "signatures"("idNumber");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_nik_idx" ON "users"("nik");
