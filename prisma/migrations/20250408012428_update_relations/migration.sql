/*
  Warnings:

  - You are about to drop the column `fotoFileName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `ktpFileName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simAFileName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simBFileName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratBebasNarkobaFileName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratSehatButaWarnaFileName` on the `participants` table. All the data in the column will be lost.
  - Added the required column `participantId` to the `certificates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "participantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "participants" DROP COLUMN "fotoFileName",
DROP COLUMN "ktpFileName",
DROP COLUMN "simAFileName",
DROP COLUMN "simBFileName",
DROP COLUMN "suratBebasNarkobaFileName",
DROP COLUMN "suratSehatButaWarnaFileName";

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
