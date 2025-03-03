/*
  Warnings:

  - Added the required column `qr_code` to the `participants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "qr_code",
ADD COLUMN     "qr_code" BYTEA NOT NULL;
