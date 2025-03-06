/*
  Warnings:

  - A unique constraint covering the columns `[noPegawai]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[noPegawai]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "participants_noPegawai_key" ON "participants"("noPegawai");

-- CreateIndex
CREATE UNIQUE INDEX "users_noPegawai_key" ON "users"("noPegawai");
