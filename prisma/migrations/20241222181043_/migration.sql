/*
  Warnings:

  - You are about to drop the column `participantCotId` on the `certificates` table. All the data in the column will be lost.
  - Added the required column `cotId` to the `certificates` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_participantCotId_fkey";

-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "participantCotId",
ADD COLUMN     "cotId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "cots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
