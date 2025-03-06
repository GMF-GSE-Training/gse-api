/*
  Warnings:

  - You are about to drop the column `kodeRating` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `kodeTraining` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `namaTraining` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `totalDurasi` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `totalDurasiPraktekKompetensi` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `totalDurasiPraktekRegGse` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `totalDurasiTeoriKompetensi` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `totalDurasiTeoriRegGse` on the `capabilities` table. All the data in the column will be lost.
  - You are about to drop the column `instrukturPraktek1` on the `cots` table. All the data in the column will be lost.
  - You are about to drop the column `instrukturPraktek2` on the `cots` table. All the data in the column will be lost.
  - You are about to drop the column `instrukturTeoriKompetensi` on the `cots` table. All the data in the column will be lost.
  - You are about to drop the column `instrukturTeoriRegulasiGse` on the `cots` table. All the data in the column will be lost.
  - You are about to drop the column `lokasiTraining` on the `cots` table. All the data in the column will be lost.
  - You are about to drop the column `tanggalMulai` on the `cots` table. All the data in the column will be lost.
  - You are about to drop the column `tanggalSelesai` on the `cots` table. All the data in the column will be lost.
  - You are about to drop the column `durasiPraktek` on the `curriculumSyllabus` table. All the data in the column will be lost.
  - You are about to drop the column `durasiTeori` on the `curriculumSyllabus` table. All the data in the column will be lost.
  - You are about to drop the column `nama` on the `curriculumSyllabus` table. All the data in the column will be lost.
  - You are about to drop the column `linkQrCode` on the `participants` table. All the data in the column will be lost.
  - Added the required column `ratingCode` to the `capabilities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trainingCode` to the `capabilities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trainingName` to the `capabilities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `practicalInstructor1` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `practicalInstructor2` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `theoryInstructorCompetency` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `theoryInstructorRegGse` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trainingLocation` to the `cots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `curriculumSyllabus` table without a default value. This is not possible if the table is not empty.
  - Added the required column `practiceDuration` to the `curriculumSyllabus` table without a default value. This is not possible if the table is not empty.
  - Added the required column `theoryDuration` to the `curriculumSyllabus` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "capabilities" DROP COLUMN "kodeRating",
DROP COLUMN "kodeTraining",
DROP COLUMN "namaTraining",
DROP COLUMN "totalDurasi",
DROP COLUMN "totalDurasiPraktekKompetensi",
DROP COLUMN "totalDurasiPraktekRegGse",
DROP COLUMN "totalDurasiTeoriKompetensi",
DROP COLUMN "totalDurasiTeoriRegGse",
ADD COLUMN     "ratingCode" VARCHAR(20) NOT NULL,
ADD COLUMN     "totalDuration" INTEGER,
ADD COLUMN     "totalPracticeDurationCompetency" INTEGER,
ADD COLUMN     "totalPracticeDurationRegGse" INTEGER,
ADD COLUMN     "totalTheoryDurationCompetency" INTEGER,
ADD COLUMN     "totalTheoryDurationRegGse" INTEGER,
ADD COLUMN     "trainingCode" VARCHAR(50) NOT NULL,
ADD COLUMN     "trainingName" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "cots" DROP COLUMN "instrukturPraktek1",
DROP COLUMN "instrukturPraktek2",
DROP COLUMN "instrukturTeoriKompetensi",
DROP COLUMN "instrukturTeoriRegulasiGse",
DROP COLUMN "lokasiTraining",
DROP COLUMN "tanggalMulai",
DROP COLUMN "tanggalSelesai",
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "practicalInstructor1" VARCHAR(50) NOT NULL,
ADD COLUMN     "practicalInstructor2" VARCHAR(50) NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "theoryInstructorCompetency" VARCHAR(50) NOT NULL,
ADD COLUMN     "theoryInstructorRegGse" VARCHAR(50) NOT NULL,
ADD COLUMN     "trainingLocation" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "curriculumSyllabus" DROP COLUMN "durasiPraktek",
DROP COLUMN "durasiTeori",
DROP COLUMN "nama",
ADD COLUMN     "name" VARCHAR(50) NOT NULL,
ADD COLUMN     "practiceDuration" INTEGER NOT NULL,
ADD COLUMN     "theoryDuration" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "participants" DROP COLUMN "linkQrCode",
ADD COLUMN     "qrCodeLink" VARCHAR(255);
