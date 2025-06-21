/*
  Warnings:

  - A unique constraint covering the columns `[participantIdCardId]` on the table `file_metadata` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "file_metadata" ADD COLUMN     "participantIdCardId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_participantIdCardId_key" ON "file_metadata"("participantIdCardId");

-- AddForeignKey
ALTER TABLE "file_metadata" ADD CONSTRAINT "file_metadata_participantIdCardId_fkey" FOREIGN KEY ("participantIdCardId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
