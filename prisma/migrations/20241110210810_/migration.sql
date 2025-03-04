/*
  Warnings:

  - You are about to drop the column `kehadiran` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `nilaiPraktek` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `nilaiTeori` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `noSertifikat` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `nama` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `negara` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `noPegawai` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `noTelp` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `perusahaan` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `tanggalLahir` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `tempatLahir` on the `participants` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `roles` table. All the data in the column will be lost.
  - You are about to drop the column `eSignFileName` on the `signatures` table. All the data in the column will be lost.
  - You are about to drop the column `noPegawai` on the `signatures` table. All the data in the column will be lost.
  - You are about to drop the column `noPegawai` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idNumber]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idNumber]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `attendance` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `certificateNumber` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `practiceScore` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `theoryScore` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `participants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `roles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idNumber` to the `signatures` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "participants_noPegawai_key";

-- DropIndex
DROP INDEX "users_noPegawai_key";

-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "kehadiran",
DROP COLUMN "nilaiPraktek",
DROP COLUMN "nilaiTeori",
DROP COLUMN "noSertifikat",
ADD COLUMN     "attendance" BOOLEAN NOT NULL,
ADD COLUMN     "certificateNumber" VARCHAR(50) NOT NULL,
ADD COLUMN     "practiceScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "theoryScore" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "participants" DROP COLUMN "nama",
DROP COLUMN "negara",
DROP COLUMN "noPegawai",
DROP COLUMN "noTelp",
DROP COLUMN "perusahaan",
DROP COLUMN "tanggalLahir",
DROP COLUMN "tempatLahir",
ADD COLUMN     "company" VARCHAR(50),
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "idNumber" VARCHAR(20),
ADD COLUMN     "name" VARCHAR(50) NOT NULL,
ADD COLUMN     "nationality" VARCHAR(50),
ADD COLUMN     "phone" VARCHAR(50),
ADD COLUMN     "placeOfBirth" VARCHAR(50);

-- AlterTable
ALTER TABLE "roles" DROP COLUMN "role",
ADD COLUMN     "name" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "signatures" DROP COLUMN "eSignFileName",
DROP COLUMN "noPegawai",
ADD COLUMN     "idNumber" VARCHAR(20) NOT NULL,
ADD COLUMN     "signFileName" VARCHAR(255);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "noPegawai",
ADD COLUMN     "idNumber" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "participants_idNumber_key" ON "participants"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_idNumber_key" ON "users"("idNumber");
