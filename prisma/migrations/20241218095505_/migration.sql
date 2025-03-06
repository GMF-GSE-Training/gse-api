/*
  Warnings:

  - You are about to drop the column `signFileName` on the `signatures` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "signatures" DROP COLUMN "signFileName",
ADD COLUMN     "eSignFileName" VARCHAR(255);
