/*
  Warnings:

  - You are about to drop the column `phone` on the `participants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "participants" DROP COLUMN "phone",
ADD COLUMN     "phoneNumber" VARCHAR(50);
