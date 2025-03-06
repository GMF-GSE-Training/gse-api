/*
  Warnings:

  - Made the column `nama` on table `participants` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "participants" ALTER COLUMN "nama" SET NOT NULL,
ALTER COLUMN "perusahaan" DROP NOT NULL,
ALTER COLUMN "no_telp" DROP NOT NULL,
ALTER COLUMN "negara" DROP NOT NULL,
ALTER COLUMN "tempat_lahir" DROP NOT NULL,
ALTER COLUMN "tanggal_lahir" DROP NOT NULL,
ALTER COLUMN "exp_surat_sehat" DROP NOT NULL,
ALTER COLUMN "exp_bebas_narkoba" DROP NOT NULL,
ALTER COLUMN "gmf_non_gmf" DROP NOT NULL,
ALTER COLUMN "sim_a" DROP NOT NULL,
ALTER COLUMN "sim_b" DROP NOT NULL,
ALTER COLUMN "ktp" DROP NOT NULL,
ALTER COLUMN "foto" DROP NOT NULL,
ALTER COLUMN "surat_sehat_buta_warna" DROP NOT NULL,
ALTER COLUMN "surat_bebas_narkoba" DROP NOT NULL;
