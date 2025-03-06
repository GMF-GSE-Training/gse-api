/*
  Warnings:

  - You are about to drop the `Cot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `participants_cot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Cot";

-- DropTable
DROP TABLE "participants_cot";

-- CreateTable
CREATE TABLE "COT" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "kode_cot" VARCHAR(20) NOT NULL,
    "tanggal_mulai" TIMESTAMP(3) NOT NULL,
    "tanggal_selesai" TIMESTAMP(3) NOT NULL,
    "lokasi_training" VARCHAR(50) NOT NULL,
    "instruktur_regulasi_gse" VARCHAR(50) NOT NULL,
    "instruktur_teori_regulasi_gse" VARCHAR(50) NOT NULL,
    "instruktur_praktek1" VARCHAR(50) NOT NULL,
    "instruktur_praktek2" VARCHAR(50) NOT NULL,
    "status" BOOLEAN NOT NULL,

    CONSTRAINT "COT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ParticipantsCOT" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipantsCOT_AB_unique" ON "_ParticipantsCOT"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipantsCOT_B_index" ON "_ParticipantsCOT"("B");

-- AddForeignKey
ALTER TABLE "_ParticipantsCOT" ADD CONSTRAINT "_ParticipantsCOT_A_fkey" FOREIGN KEY ("A") REFERENCES "COT"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantsCOT" ADD CONSTRAINT "_ParticipantsCOT_B_fkey" FOREIGN KEY ("B") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
