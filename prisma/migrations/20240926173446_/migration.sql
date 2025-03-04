/*
  Warnings:

  - You are about to drop the column `curriculumId` on the `kompetensi` table. All the data in the column will be lost.
  - You are about to drop the column `durasi_praktek` on the `kompetensi` table. All the data in the column will be lost.
  - You are about to drop the column `durasi_teori` on the `kompetensi` table. All the data in the column will be lost.
  - You are about to drop the column `curriculumId` on the `regulasi_gse` table. All the data in the column will be lost.
  - You are about to drop the column `durasi_praktek` on the `regulasi_gse` table. All the data in the column will be lost.
  - You are about to drop the column `durasi_teori` on the `regulasi_gse` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "kompetensi" DROP CONSTRAINT "kompetensi_curriculumId_fkey";

-- DropForeignKey
ALTER TABLE "regulasi_gse" DROP CONSTRAINT "regulasi_gse_curriculumId_fkey";

-- AlterTable
ALTER TABLE "kompetensi" DROP COLUMN "curriculumId",
DROP COLUMN "durasi_praktek",
DROP COLUMN "durasi_teori";

-- AlterTable
ALTER TABLE "regulasi_gse" DROP COLUMN "curriculumId",
DROP COLUMN "durasi_praktek",
DROP COLUMN "durasi_teori";

-- CreateTable
CREATE TABLE "regulasi_gse_curriculum_syllabus" (
    "id" TEXT NOT NULL,
    "durasi_teori" INTEGER NOT NULL,
    "durasi_praktek" INTEGER NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "regulasiGSEId" TEXT NOT NULL,

    CONSTRAINT "regulasi_gse_curriculum_syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kompetensi_curriculum_syllabus" (
    "id" TEXT NOT NULL,
    "durasi_teori" INTEGER NOT NULL,
    "durasi_praktek" INTEGER NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "kompetensiId" TEXT NOT NULL,

    CONSTRAINT "kompetensi_curriculum_syllabus_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "regulasi_gse_curriculum_syllabus" ADD CONSTRAINT "regulasi_gse_curriculum_syllabus_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculum_syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulasi_gse_curriculum_syllabus" ADD CONSTRAINT "regulasi_gse_curriculum_syllabus_regulasiGSEId_fkey" FOREIGN KEY ("regulasiGSEId") REFERENCES "regulasi_gse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kompetensi_curriculum_syllabus" ADD CONSTRAINT "kompetensi_curriculum_syllabus_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculum_syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kompetensi_curriculum_syllabus" ADD CONSTRAINT "kompetensi_curriculum_syllabus_kompetensiId_fkey" FOREIGN KEY ("kompetensiId") REFERENCES "kompetensi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
