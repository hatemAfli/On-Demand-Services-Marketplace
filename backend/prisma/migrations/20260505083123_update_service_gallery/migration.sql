/*
  Warnings:

  - Added the required column `type` to the `service_gallery` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GalleryImageType" AS ENUM ('BEFORE', 'AFTER');

-- DropIndex
DROP INDEX "verification_profil_requests_user_id_key";

-- AlterTable
ALTER TABLE "service_gallery" ADD COLUMN     "type" "GalleryImageType" NOT NULL;

-- CreateIndex
CREATE INDEX "service_gallery_given_service_id_type_idx" ON "service_gallery"("given_service_id", "type");
