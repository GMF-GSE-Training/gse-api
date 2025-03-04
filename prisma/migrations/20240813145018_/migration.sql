/*
  Warnings:

  - You are about to drop the column `dinas` on the `users` table. All the data in the column will be lost.
  - Added the required column `dinas` to the `participants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gmf_non_gmf` to the `participants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "dinas" VARCHAR(50) NOT NULL,
ADD COLUMN     "gmf_non_gmf" VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "dinas";
