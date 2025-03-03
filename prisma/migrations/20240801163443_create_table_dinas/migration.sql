/*
  Warnings:

  - Added the required column `dinasId` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dinasId" INTEGER NOT NULL,
ALTER COLUMN "password" SET DATA TYPE VARCHAR(100);

-- CreateTable
CREATE TABLE "dinas" (
    "id" SERIAL NOT NULL,
    "dinas" VARCHAR(50) NOT NULL,

    CONSTRAINT "dinas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_dinasId_fkey" FOREIGN KEY ("dinasId") REFERENCES "dinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
