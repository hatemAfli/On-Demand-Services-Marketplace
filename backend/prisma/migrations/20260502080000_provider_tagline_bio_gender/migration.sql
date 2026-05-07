-- Idempotent: safe if replayed (shadow DB / drift repair)
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
