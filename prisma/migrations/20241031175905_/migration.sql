/*
  Warnings:

  - A unique constraint covering the columns `[participantId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "participantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_participantId_key" ON "users"("participantId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
