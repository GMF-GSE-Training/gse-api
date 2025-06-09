/*
  Warnings:

  - You are about to drop the column `cotId` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the column `participantId` on the `sertifikat` table. All the data in the column will be lost.
  - You are about to drop the `Signature` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `participant_cot_id` to the `sertifikat` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "sertifikat" DROP CONSTRAINT "sertifikat_cotId_fkey";

-- DropForeignKey
ALTER TABLE "sertifikat" DROP CONSTRAINT "sertifikat_participantId_fkey";

-- DropForeignKey
ALTER TABLE "sertifikat" DROP CONSTRAINT "sertifikat_signatureId_fkey";

-- AlterTable
ALTER TABLE "sertifikat" DROP COLUMN "cotId",
DROP COLUMN "participantId",
ADD COLUMN     "participant_cot_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "Signature";

-- CreateTable
CREATE TABLE "participants_cot" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,

    CONSTRAINT "participants_cot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature" (
    "id" TEXT NOT NULL,
    "no_pegawai" VARCHAR(20) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "e_sign" BYTEA NOT NULL,
    "status" BOOLEAN NOT NULL,

    CONSTRAINT "signature_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "participants_cot" ADD CONSTRAINT "participants_cot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants_cot" ADD CONSTRAINT "participants_cot_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "COT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sertifikat" ADD CONSTRAINT "sertifikat_participant_cot_id_fkey" FOREIGN KEY ("participant_cot_id") REFERENCES "participants_cot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sertifikat" ADD CONSTRAINT "sertifikat_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "signature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
