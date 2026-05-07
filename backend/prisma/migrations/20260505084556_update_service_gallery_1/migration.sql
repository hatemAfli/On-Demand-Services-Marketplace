/*
  Warnings:

  - You are about to drop the column `type` on the `service_gallery` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "service_gallery_given_service_id_type_idx";

-- AlterTable
ALTER TABLE "service_gallery" DROP COLUMN "type";

-- DropEnum
DROP TYPE "GalleryImageType";
