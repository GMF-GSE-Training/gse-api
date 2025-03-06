/*
  Warnings:

  - You are about to drop the `curriculum_syllabus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kompetensi` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kompetensi_curriculum_syllabus` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `regulasi_gse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `regulasi_gse_curriculum_syllabus` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "curriculum_syllabus" DROP CONSTRAINT "curriculum_syllabus_capabilityId_fkey";

-- DropForeignKey
ALTER TABLE "kompetensi_curriculum_syllabus" DROP CONSTRAINT "kompetensi_curriculum_syllabus_curriculumId_fkey";

-- DropForeignKey
ALTER TABLE "kompetensi_curriculum_syllabus" DROP CONSTRAINT "kompetensi_curriculum_syllabus_kompetensiId_fkey";

-- DropForeignKey
ALTER TABLE "regulasi_gse_curriculum_syllabus" DROP CONSTRAINT "regulasi_gse_curriculum_syllabus_curriculumId_fkey";

-- DropForeignKey
ALTER TABLE "regulasi_gse_curriculum_syllabus" DROP CONSTRAINT "regulasi_gse_curriculum_syllabus_regulasiGSEId_fkey";

-- DropTable
DROP TABLE "curriculum_syllabus";

-- DropTable
DROP TABLE "kompetensi";

-- DropTable
DROP TABLE "kompetensi_curriculum_syllabus";

-- DropTable
DROP TABLE "regulasi_gse";

-- DropTable
DROP TABLE "regulasi_gse_curriculum_syllabus";

-- CreateTable
CREATE TABLE "CurriculumSyllabus" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "durasi_teori" INTEGER NOT NULL,
    "durasi_praktek" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,

    CONSTRAINT "CurriculumSyllabus_pkey" PRIMARY KEY ("id")
);
