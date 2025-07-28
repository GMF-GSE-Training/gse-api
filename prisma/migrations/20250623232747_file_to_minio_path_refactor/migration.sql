/*
  Warnings:

  - You are about to drop the column `foto` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `ktp` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `qrCode` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `qrCodeLink` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simA` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `simB` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratBebasNarkoba` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `suratSehatButaWarna` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `eSign` on the `signatures` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "foto",
DROP COLUMN "ktp",
DROP COLUMN "qrCode",
DROP COLUMN "qrCodeLink",
DROP COLUMN "simA",
DROP COLUMN "simB",
DROP COLUMN "suratBebasNarkoba",
DROP COLUMN "suratSehatButaWarna",
ADD COLUMN     "fotoPath" VARCHAR(255),
ADD COLUMN     "ktpPath" VARCHAR(255),
ADD COLUMN     "qrCodePath" TEXT,
ADD COLUMN     "simAPath" VARCHAR(255),
ADD COLUMN     "simBPath" VARCHAR(255),
ADD COLUMN     "suratBebasNarkobaPath" VARCHAR(255),
ADD COLUMN     "suratSehatButaWarnaPath" VARCHAR(255);

-- AlterTable
ALTER TABLE "signatures" DROP COLUMN "eSign",
ADD COLUMN     "eSignPath" VARCHAR(255);
