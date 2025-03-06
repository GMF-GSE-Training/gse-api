-- DropForeignKey
ALTER TABLE "participantsCot" DROP CONSTRAINT "participantsCot_participantId_fkey";

-- AlterTable
ALTER TABLE "participantsCot" ALTER COLUMN "participantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "participantsCot" ADD CONSTRAINT "participantsCot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
