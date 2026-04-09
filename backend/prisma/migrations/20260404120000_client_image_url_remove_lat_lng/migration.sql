-- AlterTable: clients — replace latitude/longitude with optional image_url
ALTER TABLE "clients" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "clients" DROP COLUMN IF EXISTS "longitude";
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
