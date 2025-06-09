-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('SIGNATURE1', 'SIGNATURE2');

-- AlterTable
ALTER TABLE "signatures" ADD COLUMN     "signatureType" "SignatureType" NOT NULL DEFAULT 'SIGNATURE1';
