/*
  Warnings:

  - You are about to drop the `_COTToCapability` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_COTToCapability" DROP CONSTRAINT "_COTToCapability_A_fkey";

-- DropForeignKey
ALTER TABLE "_COTToCapability" DROP CONSTRAINT "_COTToCapability_B_fkey";

-- DropTable
DROP TABLE "_COTToCapability";

-- CreateTable
CREATE TABLE "CapabilityCOT" (
    "capabilityId" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,

    CONSTRAINT "CapabilityCOT_pkey" PRIMARY KEY ("capabilityId","cotId")
);

-- AddForeignKey
ALTER TABLE "CapabilityCOT" ADD CONSTRAINT "CapabilityCOT_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityCOT" ADD CONSTRAINT "CapabilityCOT_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "COT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
