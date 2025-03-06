-- DropForeignKey
ALTER TABLE "curriculum_syllabus" DROP CONSTRAINT "curriculum_syllabus_capabilityId_fkey";

-- AlterTable
ALTER TABLE "curriculum_syllabus" ALTER COLUMN "capabilityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "curriculum_syllabus" ADD CONSTRAINT "curriculum_syllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE SET NULL ON UPDATE CASCADE;
