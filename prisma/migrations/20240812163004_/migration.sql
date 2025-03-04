/*
  Warnings:

  - You are about to alter the column `sim_a` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(255)`.
  - You are about to alter the column `sim_b` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(255)`.
  - You are about to alter the column `ktp` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(255)`.
  - You are about to alter the column `foto` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(255)`.
  - You are about to alter the column `surat_sehat_buta_warna` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(255)`.
  - You are about to alter the column `surat_bebas_narkoba` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(255)`.
  - You are about to alter the column `qr_code` on the `participants` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(255)`.

*/
-- AlterTable
ALTER TABLE "participants" ALTER COLUMN "sim_a" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "sim_b" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "ktp" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "foto" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "surat_sehat_buta_warna" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "surat_bebas_narkoba" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "qr_code" SET DATA TYPE VARCHAR(255);
