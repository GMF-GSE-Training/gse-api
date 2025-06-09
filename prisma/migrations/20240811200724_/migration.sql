/*
  Warnings:

  - Added the required column `exp_bebas_narkoba` to the `participants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "exp_bebas_narkoba" DATE NOT NULL;
