-- DropForeignKey
ALTER TABLE "COT" DROP CONSTRAINT "COT_capabilityId_fkey";

-- DropIndex
DROP INDEX "COT_capabilityId_key";

-- CreateTable
CREATE TABLE "_COTToCapability" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_COTToCapability_AB_unique" ON "_COTToCapability"("A", "B");

-- CreateIndex
CREATE INDEX "_COTToCapability_B_index" ON "_COTToCapability"("B");

-- AddForeignKey
ALTER TABLE "_COTToCapability" ADD CONSTRAINT "_COTToCapability_A_fkey" FOREIGN KEY ("A") REFERENCES "COT"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_COTToCapability" ADD CONSTRAINT "_COTToCapability_B_fkey" FOREIGN KEY ("B") REFERENCES "capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
