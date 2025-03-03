-- AlterTable
ALTER TABLE "participants" ALTER COLUMN "company" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refreshToken" VARCHAR(255);
