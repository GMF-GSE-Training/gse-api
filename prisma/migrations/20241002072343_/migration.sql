/*
  Warnings:

  - You are about to drop the `CurriculumSyllabus` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "CurriculumSyllabus";

-- CreateTable
CREATE TABLE "curriculum_syllabus" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "durasi_teori" INTEGER NOT NULL,
    "durasi_praktek" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,

    CONSTRAINT "curriculum_syllabus_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "curriculum_syllabus" ADD CONSTRAINT "curriculum_syllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
