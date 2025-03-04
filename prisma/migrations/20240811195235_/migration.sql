-- DropForeignKey
ALTER TABLE "participants" DROP CONSTRAINT "participants_nik_fkey";

-- DropIndex
DROP INDEX "participants_nik_key";

-- DropIndex
DROP INDEX "users_nik_key";
