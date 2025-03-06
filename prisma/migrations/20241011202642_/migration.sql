/*
  Warnings:

  - You are about to drop the `_ParticipantsCOT` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ParticipantsCOT" DROP CONSTRAINT "_ParticipantsCOT_A_fkey";

-- DropForeignKey
ALTER TABLE "_ParticipantsCOT" DROP CONSTRAINT "_ParticipantsCOT_B_fkey";

-- DropTable
DROP TABLE "_ParticipantsCOT";
