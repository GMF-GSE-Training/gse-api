/*
  Warnings:

  - Made the column `perusahaan` on table `participants` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "participants" ALTER COLUMN "perusahaan" SET NOT NULL;
