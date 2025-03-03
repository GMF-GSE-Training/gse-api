/*
  Warnings:

  - You are about to drop the `COT` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CapabilityCOT` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `capability` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sertifikat` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `signature` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CapabilityCOT" DROP CONSTRAINT "CapabilityCOT_capabilityId_fkey";

-- DropForeignKey
ALTER TABLE "CapabilityCOT" DROP CONSTRAINT "CapabilityCOT_cotId_fkey";

-- DropForeignKey
ALTER TABLE "curriculumSyllabus" DROP CONSTRAINT "curriculumSyllabus_capabilityId_fkey";

-- DropForeignKey
ALTER TABLE "participantsCot" DROP CONSTRAINT "participantsCot_cotId_fkey";

-- DropForeignKey
ALTER TABLE "sertifikat" DROP CONSTRAINT "sertifikat_participantCotId_fkey";

-- DropForeignKey
ALTER TABLE "sertifikat" DROP CONSTRAINT "sertifikat_signatureId_fkey";

-- DropTable
DROP TABLE "COT";

-- DropTable
DROP TABLE "CapabilityCOT";

-- DropTable
DROP TABLE "capability";

-- DropTable
DROP TABLE "sertifikat";

-- DropTable
DROP TABLE "signature";

-- CreateTable
CREATE TABLE "capabilities" (
    "id" TEXT NOT NULL,
    "kodeRating" VARCHAR(20) NOT NULL,
    "kodeTraining" VARCHAR(50) NOT NULL,
    "namaTraining" VARCHAR(50) NOT NULL,
    "totalDurasiTeoriRegGse" INTEGER,
    "totalDurasiPraktekRegGse" INTEGER,
    "totalDurasiTeoriKompetensi" INTEGER,
    "totalDurasiPraktekKompetensi" INTEGER,
    "totalDurasi" INTEGER,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cots" (
    "id" TEXT NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3) NOT NULL,
    "lokasiTraining" VARCHAR(50) NOT NULL,
    "instrukturTeoriRegulasiGse" VARCHAR(50) NOT NULL,
    "instrukturTeoriKompetensi" VARCHAR(50) NOT NULL,
    "instrukturPraktek1" VARCHAR(50) NOT NULL,
    "instrukturPraktek2" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,

    CONSTRAINT "cots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capabilityCots" (
    "capabilityId" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,

    CONSTRAINT "capabilityCots_pkey" PRIMARY KEY ("capabilityId","cotId")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "noPegawai" VARCHAR(20) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "eSign" BYTEA NOT NULL,
    "eSignFileName" VARCHAR(255),
    "status" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "participantCotId" TEXT NOT NULL,
    "signatureId" TEXT NOT NULL,
    "noSertifikat" VARCHAR(50) NOT NULL,
    "kehadiran" BOOLEAN NOT NULL,
    "nilaiTeori" DOUBLE PRECISION NOT NULL,
    "nilaiPraktek" DOUBLE PRECISION NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "curriculumSyllabus" ADD CONSTRAINT "curriculumSyllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capabilityCots" ADD CONSTRAINT "capabilityCots_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capabilityCots" ADD CONSTRAINT "capabilityCots_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "cots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantsCot" ADD CONSTRAINT "participantsCot_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "cots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_participantCotId_fkey" FOREIGN KEY ("participantCotId") REFERENCES "participantsCot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "signatures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
