/*
  Warnings:

  - The values [OTHER,PREFER_NOT_TO_SAY] on the enum `ProviderGender` will be removed. If these variants are still used in the database, this will fail.

*/
-- If a shadow DB or older branch skipped the previous migration, ensure enum + columns exist
-- before altering `gender` (fixes P3006: column "gender" does not exist).
DO $$
BEGIN
  CREATE TYPE "ProviderGender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "tagline" TEXT;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "years_of_experience" INTEGER;
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "languages_spoken" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "gender" "ProviderGender";

-- AlterEnum
BEGIN;
CREATE TYPE "ProviderGender_new" AS ENUM ('FEMALE', 'MALE');
ALTER TABLE "providers" ALTER COLUMN "gender" TYPE "ProviderGender_new" USING ("gender"::text::"ProviderGender_new");
ALTER TYPE "ProviderGender" RENAME TO "ProviderGender_old";
ALTER TYPE "ProviderGender_new" RENAME TO "ProviderGender";
DROP TYPE "public"."ProviderGender_old";
COMMIT;

-- AlterTable
ALTER TABLE "providers" ALTER COLUMN "languages_spoken" SET DEFAULT ARRAY['Arabic']::TEXT[];
