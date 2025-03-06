-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "no_pegawai" VARCHAR(20) NOT NULL,
    "email" VARCHAR(50) NOT NULL,
    "nama" VARCHAR(50) NOT NULL,
    "password" VARCHAR(20) NOT NULL,
    "token" VARCHAR(100),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);