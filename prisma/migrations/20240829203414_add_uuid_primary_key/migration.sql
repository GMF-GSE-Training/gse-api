/*
  Warnings:

  - The primary key for the `capability` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `curriculumSyllabus` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `participants` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "curriculumSyllabus" DROP CONSTRAINT "curriculumSyllabus_capabilityId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_roleId_fkey";

-- AlterTable
ALTER TABLE "capability" DROP CONSTRAINT "capability_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "capability_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "capability_id_seq";

-- AlterTable
ALTER TABLE "curriculumSyllabus" DROP CONSTRAINT "curriculumSyllabus_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "capabilityId" SET DATA TYPE TEXT,
ADD CONSTRAINT "curriculumSyllabus_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "curriculumSyllabus_id_seq";

-- AlterTable
ALTER TABLE "participants" DROP CONSTRAINT "participants_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "participants_id_seq";

-- AlterTable
ALTER TABLE "roles" DROP CONSTRAINT "roles_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "roles_id_seq";

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "users_id_seq";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculumSyllabus" ADD CONSTRAINT "curriculumSyllabus_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "capability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
