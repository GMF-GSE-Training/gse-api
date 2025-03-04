/*
  Warnings:

  - You are about to drop the column `dinasId` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nik,dinas]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gmf_non_gmf` to the `participants` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_dinasId_fkey";

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "gmf_non_gmf" VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "dinasId",
ADD COLUMN     "dinas" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "participants_nik_dinas_key" ON "participants"("nik", "dinas");
