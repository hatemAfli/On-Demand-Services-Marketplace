/*
  Warnings:

  - You are about to drop the column `company_id` on the `given_services` table. All the data in the column will be lost.
  - You are about to drop the column `provider_id` on the `given_services` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "given_services" DROP CONSTRAINT "given_services_company_id_fkey";

-- DropForeignKey
ALTER TABLE "given_services" DROP CONSTRAINT "given_services_provider_id_fkey";

-- DropIndex
DROP INDEX "given_services_company_id_idx";

-- DropIndex
DROP INDEX "given_services_provider_id_idx";

-- AlterTable
ALTER TABLE "given_services" DROP COLUMN "company_id",
DROP COLUMN "provider_id",
ALTER COLUMN "active" SET DEFAULT false;
