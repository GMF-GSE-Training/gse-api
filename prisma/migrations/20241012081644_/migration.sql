/*
  Warnings:

  - You are about to drop the column `expBebasNarkoba` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `expSuratSehat` on the `participants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "expBebasNarkoba",
DROP COLUMN "expSuratSehat",
ADD COLUMN     "expSuratBebasNarkoba" DATE,
ADD COLUMN     "expSuratSehatButaWarna" DATE;
