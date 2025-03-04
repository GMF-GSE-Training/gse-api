/*
  Warnings:

  - You are about to alter the column `kompetensi` on the `kompetensi` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(50)`.
  - You are about to alter the column `reg_gse` on the `regulasi_gse` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(50)`.

*/
-- AlterTable
ALTER TABLE "kompetensi" ALTER COLUMN "kompetensi" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "regulasi_gse" ALTER COLUMN "reg_gse" SET DATA TYPE VARCHAR(50);
