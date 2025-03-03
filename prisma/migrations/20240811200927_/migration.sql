/*
  Warnings:

  - A unique constraint covering the columns `[nik]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nik]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "participants_nik_key" ON "participants"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "users_nik_key" ON "users"("nik");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_nik_fkey" FOREIGN KEY ("nik") REFERENCES "users"("nik") ON DELETE RESTRICT ON UPDATE CASCADE;
