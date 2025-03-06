/*
  Warnings:

  - A unique constraint covering the columns `[capabilityId]` on the table `COT` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "COT_capabilityId_key" ON "COT"("capabilityId");

-- AddForeignKey
ALTER TABLE "COT" ADD CONSTRAINT "COT_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
