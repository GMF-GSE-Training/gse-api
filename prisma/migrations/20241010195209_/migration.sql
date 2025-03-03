-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "no_pegawai" VARCHAR(20) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "e_sign" BYTEA NOT NULL,
    "status" BOOLEAN NOT NULL,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sertifikat" (
    "id" TEXT NOT NULL,
    "no_sertifikat" VARCHAR(50) NOT NULL,
    "participantId" TEXT NOT NULL,
    "cotId" TEXT NOT NULL,
    "signatureId" TEXT NOT NULL,
    "kehadiran" BOOLEAN NOT NULL,
    "nilai_teori" DOUBLE PRECISION NOT NULL,
    "nilai_praktek" DOUBLE PRECISION NOT NULL,
    "status" BOOLEAN NOT NULL,

    CONSTRAINT "sertifikat_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sertifikat" ADD CONSTRAINT "sertifikat_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sertifikat" ADD CONSTRAINT "sertifikat_cotId_fkey" FOREIGN KEY ("cotId") REFERENCES "COT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sertifikat" ADD CONSTRAINT "sertifikat_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "Signature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
