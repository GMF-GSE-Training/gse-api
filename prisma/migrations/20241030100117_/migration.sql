/*
  Warnings:

  - You are about to drop the column `instrukturRegulasiGse` on the `COT` table. All the data in the column will be lost.
  - Added the required column `instrukturTeoriKompetensi` to the `COT` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "COT" DROP COLUMN "instrukturRegulasiGse",
ADD COLUMN     "instrukturTeoriKompetensi" VARCHAR(50) NOT NULL;
