/*
  Warnings:

  - You are about to drop the column `isVerified` on the `providers` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('FIXED', 'HOURLY');

-- AlterTable
ALTER TABLE "providers" DROP COLUMN "isVerified";

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "given_services" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "pricing_type" "PricingType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "provider_id" UUID,
    "company_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "given_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_gallery" (
    "id" UUID NOT NULL,
    "given_service_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,

    CONSTRAINT "service_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "given_services_service_id_idx" ON "given_services"("service_id");

-- CreateIndex
CREATE INDEX "given_services_provider_id_idx" ON "given_services"("provider_id");

-- CreateIndex
CREATE INDEX "given_services_company_id_idx" ON "given_services"("company_id");

-- CreateIndex
CREATE INDEX "given_services_owner_type_owner_id_idx" ON "given_services"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "given_services_active_idx" ON "given_services"("active");

-- CreateIndex
CREATE INDEX "service_gallery_given_service_id_idx" ON "service_gallery"("given_service_id");

-- AddForeignKey
ALTER TABLE "given_services" ADD CONSTRAINT "given_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "given_services" ADD CONSTRAINT "given_services_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "given_services" ADD CONSTRAINT "given_services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_gallery" ADD CONSTRAINT "service_gallery_given_service_id_fkey" FOREIGN KEY ("given_service_id") REFERENCES "given_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
