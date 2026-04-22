/*
  Warnings:

  - You are about to drop the column `commercial_name` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `legal_name` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `main_contact` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `photo_url` on the `companies` table. All the data in the column will be lost.
  - Added the required column `company_name` to the `companies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `companies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tax_id` to the `companies` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "companies" DROP COLUMN "commercial_name",
DROP COLUMN "legal_name",
DROP COLUMN "main_contact",
DROP COLUMN "photo_url",
ADD COLUMN     "company_name" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "tax_id" TEXT NOT NULL,
ALTER COLUMN "service_zones" SET DEFAULT ARRAY[]::TEXT[];
