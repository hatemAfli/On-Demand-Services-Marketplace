-- Remove unused company brand color setting
ALTER TABLE "companies" DROP COLUMN IF EXISTS "brand_color";
