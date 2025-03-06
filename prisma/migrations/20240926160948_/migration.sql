/*
  Warnings:

  - A unique constraint covering the columns `[capabilityId]` on the table `curriculum_syllabus` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `total_durasi` to the `curriculum_syllabus` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "curriculum_syllabus" ADD COLUMN     "total_durasi" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_syllabus_capabilityId_key" ON "curriculum_syllabus"("capabilityId");
