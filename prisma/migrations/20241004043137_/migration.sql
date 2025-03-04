-- CreateTable
CREATE TABLE "Cot" (
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

    CONSTRAINT "Cot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants_cot" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,

    CONSTRAINT "participants_cot_pkey" PRIMARY KEY ("id")
);
