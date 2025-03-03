/*
  Warnings:

  - Added the required column `no_pegawai` to the `participants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "no_pegawai" VARCHAR(20) NOT NULL;
