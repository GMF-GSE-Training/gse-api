/*
  Warnings:

  - You are about to drop the column `dinas` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `gmf_non_gmf` on the `participants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "dinas",
DROP COLUMN "gmf_non_gmf";
