-- CreateTable
CREATE TABLE "capability" (
    "id" SERIAL NOT NULL,
    "kode_rating" VARCHAR(20) NOT NULL,
    "kode_training" VARCHAR(50) NOT NULL,
    "nama_training" VARCHAR(50) NOT NULL,
    "durasi_materi_rating_exam" INTEGER NOT NULL,
    "durasi_materi_reguler" INTEGER NOT NULL,
    "total_durasi_training" INTEGER NOT NULL,

    CONSTRAINT "capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculumSyllabus" (
    "id" SERIAL NOT NULL,
    "capabilityId" INTEGER NOT NULL,
    "reg_gse" VARCHAR(255) NOT NULL,
    "durasi_teori_reg" INTEGER NOT NULL,
    "durasi_praktek_reg" INTEGER NOT NULL,
    "kompetensi" VARCHAR(255) NOT NULL,
    "durasi_teori_kom" INTEGER NOT NULL,
    "durasi_praktek_kom" INTEGER NOT NULL,
    "total_durasi" INTEGER NOT NULL,

    CONSTRAINT "curriculumSyllabus_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "curriculumSyllabus" ADD CONSTRAINT "curriculumSyllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
