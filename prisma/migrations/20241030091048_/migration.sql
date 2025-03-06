/*
  Warnings:

  - You are about to drop the column `expSuratBebasNarkoba` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `expSuratSehatButaWarna` on the `participants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "expSuratBebasNarkoba",
DROP COLUMN "expSuratSehatButaWarna",
ADD COLUMN     "tglKeluarSuratBebasNarkoba" DATE,
ADD COLUMN     "tglKeluarSuratSehatButaWarna" DATE;
