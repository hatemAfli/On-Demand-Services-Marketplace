/*
  Warnings:

  - You are about to drop the `Hatem` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "email" DROP NOT NULL;

-- DropTable
DROP TABLE "Hatem";
