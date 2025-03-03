/*
  Warnings:

  - A unique constraint covering the columns `[nik]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "participants" (
    "id" SERIAL NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "nik" VARCHAR(50) NOT NULL,
    "dinas" VARCHAR(50) NOT NULL,
    "bidang" VARCHAR(50) NOT NULL,
    "perusahaan" VARCHAR(50) NOT NULL,
    "email" VARCHAR(50) NOT NULL,
    "no_telp" VARCHAR(50) NOT NULL,
    "negara" VARCHAR(50) NOT NULL,
    "tempat_lahir" VARCHAR(50) NOT NULL,
    "tanggal_lahir" DATE NOT NULL,
    "sim_a" BYTEA NOT NULL,
    "sim_b" BYTEA NOT NULL,
    "ktp" BYTEA NOT NULL,
    "foto" BYTEA NOT NULL,
    "surat_sehat_buta_warna" BYTEA NOT NULL,
    "exp_surat_sehat" DATE NOT NULL,
    "surat_bebas_narkoba" BYTEA NOT NULL,
    "qr_code" VARCHAR(255) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participants_nik_key" ON "participants"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "users_nik_key" ON "users"("nik");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_nik_fkey" FOREIGN KEY ("nik") REFERENCES "users"("nik") ON DELETE RESTRICT ON UPDATE CASCADE;
