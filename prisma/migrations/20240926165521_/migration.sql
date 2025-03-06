/*
  Warnings:

  - Made the column `capabilityId` on table `curriculum_syllabus` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "curriculum_syllabus" DROP CONSTRAINT "curriculum_syllabus_capabilityId_fkey";

-- AlterTable
ALTER TABLE "curriculum_syllabus" ALTER COLUMN "capabilityId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "curriculum_syllabus" ADD CONSTRAINT "curriculum_syllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
