/*
  Warnings:

  - You are about to drop the column `instruktur_praktek1` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `instruktur_praktek2` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `instruktur_regulasi_gse` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `instruktur_teori_regulasi_gse` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `kode_cot` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `lokasi_training` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `tanggal_mulai` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `tanggal_selesai` on the `COT` table. All the data in the column will be lost.
  - You are about to drop the column `kode_rating` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `kode_training` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `nama_training` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `total_durasi_praktek_kompetensi` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `total_durasi_praktek_reg_gse` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `total_durasi_teori_kompetensi` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `total_durasi_teori_reg_gse` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `exp_bebas_narkoba` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `exp_surat_sehat` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `foto_name` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `gmf_non_gmf` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `ktp_name` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `link_qr_code` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `no_pegawai` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `no_telp` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `qr_code` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `sim_a` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `sim_a_name` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `sim_b` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `sim_b_name` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `surat_bebas_narkoba` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `surat_bebas_narkoba_name` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `surat_sehat_buta_warna` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `surat_sehat_buta_warna_name` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `tanggal_lahir` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `tempat_lahir` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `nilai_praktek` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `nilai_teori` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `no_sertifikat` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `participant_cot_id` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `e_sign` on the `signature` table. All the data in the column will be lost.
  - You are about to drop the column `no_pegawai` on the `signature` table. All the data in the column will be lost.
  - You are about to drop the column `no_pegawai` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `curriculum_syllabus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `participants_cot` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `instrukturPraktek1` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instrukturPraktek2` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instrukturRegulasiGse` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `instrukturTeoriRegulasiGse` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kodeCot` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lokasiTraining` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggalMulai` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggalSelesai` to the `COT` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nilaiPraktek` to the `sertifikat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nilaiTeori` to the `sertifikat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `noSertifikat` to the `sertifikat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participantCotId` to the `sertifikat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eSign` to the `signature` table without a default value. This is not possible if the table is not empty.
  - Added the required column `noPegawai` to the `signature` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "curriculum_syllabus" DROP CONSTRAINT "curriculum_syllabus_capabilityId_fkey";

-- DropForeignKey
ALTER TABLE "participants_cot" DROP CONSTRAINT "participants_cot_cotId_fkey";

-- DropForeignKey
ALTER TABLE "participants_cot" DROP CONSTRAINT "participants_cot_participantId_fkey";

-- DropForeignKey
ALTER TABLE "sertifikat" DROP CONSTRAINT "sertifikat_participant_cot_id_fkey";

-- AlterTable
ALTER TABLE "COT" DROP COLUMN "instruktur_praktek1",
DROP COLUMN "instruktur_praktek2",
DROP COLUMN "instruktur_regulasi_gse",
DROP COLUMN "instruktur_teori_regulasi_gse",
DROP COLUMN "kode_cot",
DROP COLUMN "lokasi_training",
DROP COLUMN "tanggal_mulai",
DROP COLUMN "tanggal_selesai",
ADD COLUMN     "instrukturPraktek1" VARCHAR(50) NOT NULL,
ADD COLUMN     "instrukturPraktek2" VARCHAR(50) NOT NULL,
ADD COLUMN     "instrukturRegulasiGse" VARCHAR(50) NOT NULL,
ADD COLUMN     "instrukturTeoriRegulasiGse" VARCHAR(50) NOT NULL,
ADD COLUMN     "kodeCot" VARCHAR(20) NOT NULL,
ADD COLUMN     "lokasiTraining" VARCHAR(50) NOT NULL,
ADD COLUMN     "tanggalMulai" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "tanggalSelesai" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT false;

-- AlterTable
ALTER TABLE "capability" DROP COLUMN "kode_rating",
DROP COLUMN "kode_training",
DROP COLUMN "nama_training",
DROP COLUMN "total_durasi_praktek_kompetensi",
DROP COLUMN "total_durasi_praktek_reg_gse",
DROP COLUMN "total_durasi_teori_kompetensi",
DROP COLUMN "total_durasi_teori_reg_gse",
ADD COLUMN     "kodeRating" VARCHAR(20) NOT NULL DEFAULT 'BTT',
ADD COLUMN     "kodeTraining" VARCHAR(50) NOT NULL DEFAULT 'TCT - 0535',
ADD COLUMN     "namaTraining" VARCHAR(50) NOT NULL DEFAULT 'Baggage Towing Tractor',
ADD COLUMN     "totalDurasiPraktekKompetensi" INTEGER,
ADD COLUMN     "totalDurasiPraktekRegGse" INTEGER,
ADD COLUMN     "totalDurasiTeoriKompetensi" INTEGER,
ADD COLUMN     "totalDurasiTeoriRegGse" INTEGER;

-- AlterTable
ALTER TABLE "participants" DROP COLUMN "exp_bebas_narkoba",
DROP COLUMN "exp_surat_sehat",
DROP COLUMN "foto_name",
DROP COLUMN "gmf_non_gmf",
DROP COLUMN "ktp_name",
DROP COLUMN "link_qr_code",
DROP COLUMN "no_pegawai",
DROP COLUMN "no_telp",
DROP COLUMN "qr_code",
DROP COLUMN "sim_a",
DROP COLUMN "sim_a_name",
DROP COLUMN "sim_b",
DROP COLUMN "sim_b_name",
DROP COLUMN "surat_bebas_narkoba",
DROP COLUMN "surat_bebas_narkoba_name",
DROP COLUMN "surat_sehat_buta_warna",
DROP COLUMN "surat_sehat_buta_warna_name",
DROP COLUMN "tanggal_lahir",
DROP COLUMN "tempat_lahir",
ADD COLUMN     "expBebasNarkoba" DATE,
ADD COLUMN     "expSuratSehat" DATE,
ADD COLUMN     "fotoName" VARCHAR(255),
ADD COLUMN     "gmfNonGmf" VARCHAR(20),
ADD COLUMN     "ktpName" VARCHAR(255),
ADD COLUMN     "linkQrCode" VARCHAR(255),
ADD COLUMN     "noPegawai" VARCHAR(20),
ADD COLUMN     "noTelp" VARCHAR(50),
ADD COLUMN     "qrCode" BYTEA,
ADD COLUMN     "simA" BYTEA,
ADD COLUMN     "simAName" VARCHAR(255),
ADD COLUMN     "simB" BYTEA,
ADD COLUMN     "simBName" VARCHAR(255),
ADD COLUMN     "suratBebasNarkoba" BYTEA,
ADD COLUMN     "suratBebasNarkobaName" VARCHAR(255),
ADD COLUMN     "suratSehatButaWarna" BYTEA,
ADD COLUMN     "suratSehatButaWarnaName" VARCHAR(255),
ADD COLUMN     "tanggalLahir" DATE,
ADD COLUMN     "tempatLahir" VARCHAR(50);

-- AlterTable
ALTER TABLE "sertifikat" DROP COLUMN "nilai_praktek",
DROP COLUMN "nilai_teori",
DROP COLUMN "no_sertifikat",
DROP COLUMN "participant_cot_id",
ADD COLUMN     "nilaiPraktek" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "nilaiTeori" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "noSertifikat" VARCHAR(50) NOT NULL,
ADD COLUMN     "participantCotId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT true;

-- AlterTable
ALTER TABLE "signature" DROP COLUMN "e_sign",
DROP COLUMN "no_pegawai",
ADD COLUMN     "eSign" BYTEA NOT NULL,
ADD COLUMN     "noPegawai" VARCHAR(20) NOT NULL,
ALTER COLUMN "status" SET DEFAULT false;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "no_pegawai",
ADD COLUMN     "noPegawai" VARCHAR(20);

-- DropTable
DROP TABLE "curriculum_syllabus";

-- DropTable
DROP TABLE "participants_cot";

-- CreateTable
CREATE TABLE "curriculumSyllabus" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "durasiTeori" INTEGER NOT NULL,
    "durasiPraktek" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,

    CONSTRAINT "curriculumSyllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantsCot" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,

    CONSTRAINT "participantsCot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "curriculumSyllabus" ADD CONSTRAINT "curriculumSyllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantsCot" ADD CONSTRAINT "participantsCot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantsCot" ADD CONSTRAINT "participantsCot_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "COT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sertifikat" ADD CONSTRAINT "sertifikat_participantCotId_fkey" FOREIGN KEY ("participantCotId") REFERENCES "participantsCot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
