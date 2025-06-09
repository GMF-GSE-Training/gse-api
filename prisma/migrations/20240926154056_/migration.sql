/*
  Warnings:

  - You are about to drop the column `durasi_materi_rating_exam` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `durasi_materi_reguler` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the column `total_durasi_training` on the `capability` table. All the data in the column will be lost.
  - You are about to drop the `curriculumSyllabus` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "curriculumSyllabus" DROP CONSTRAINT "curriculumSyllabus_capabilityId_fkey";

-- AlterTable
ALTER TABLE "capability" DROP COLUMN "durasi_materi_rating_exam",
DROP COLUMN "durasi_materi_reguler",
DROP COLUMN "total_durasi_training";

-- DropTable
DROP TABLE "curriculumSyllabus";

-- CreateTable
CREATE TABLE "curriculum_syllabus" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,

    CONSTRAINT "curriculum_syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulasi_gse" (
    "id" TEXT NOT NULL,
    "reg_gse" VARCHAR(255) NOT NULL,
    "durasi_teori" INTEGER NOT NULL,
    "durasi_praktek" INTEGER NOT NULL,
    "curriculumId" TEXT NOT NULL,

    CONSTRAINT "regulasi_gse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kompetensi" (
    "id" TEXT NOT NULL,
    "kompetensi" VARCHAR(255) NOT NULL,
    "durasi_teori" INTEGER NOT NULL,
    "durasi_praktek" INTEGER NOT NULL,
    "curriculumId" TEXT NOT NULL,

    CONSTRAINT "kompetensi_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "curriculum_syllabus" ADD CONSTRAINT "curriculum_syllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulasi_gse" ADD CONSTRAINT "regulasi_gse_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculum_syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kompetensi" ADD CONSTRAINT "kompetensi_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculum_syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
