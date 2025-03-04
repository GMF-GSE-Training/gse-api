/*
  Warnings:

  - You are about to drop the column `fotoName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `ktpName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simAName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simBName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratBebasNarkobaName` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratSehatButaWarnaName` on the `participants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "fotoName",
DROP COLUMN "ktpName",
DROP COLUMN "simAName",
DROP COLUMN "simBName",
DROP COLUMN "suratBebasNarkobaName",
DROP COLUMN "suratSehatButaWarnaName",
ADD COLUMN     "fotoFileName" VARCHAR(255),
ADD COLUMN     "ktpFileName" VARCHAR(255),
ADD COLUMN     "simAFileName" VARCHAR(255),
ADD COLUMN     "simBFileName" VARCHAR(255),
ADD COLUMN     "suratBebasNarkobaFileName" VARCHAR(255),
ADD COLUMN     "suratSehatButaWarnaFileName" VARCHAR(255);
