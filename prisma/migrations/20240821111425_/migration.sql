/*
  Warnings:

  - You are about to drop the `dinas` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `sim_a` on the `participants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sim_b` on the `participants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `ktp` on the `participants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `foto` on the `participants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `surat_sehat_buta_warna` on the `participants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `surat_bebas_narkoba` on the `participants` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "sim_a",
ADD COLUMN     "sim_a" BYTEA NOT NULL,
DROP COLUMN "sim_b",
ADD COLUMN     "sim_b" BYTEA NOT NULL,
DROP COLUMN "ktp",
ADD COLUMN     "ktp" BYTEA NOT NULL,
DROP COLUMN "foto",
ADD COLUMN     "foto" BYTEA NOT NULL,
DROP COLUMN "surat_sehat_buta_warna",
ADD COLUMN     "surat_sehat_buta_warna" BYTEA NOT NULL,
DROP COLUMN "surat_bebas_narkoba",
ADD COLUMN     "surat_bebas_narkoba" BYTEA NOT NULL;

-- DropTable
DROP TABLE "dinas";
