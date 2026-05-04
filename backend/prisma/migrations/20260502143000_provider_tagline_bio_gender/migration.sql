-- CreateEnum
CREATE TYPE "ProviderGender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "providers" ADD COLUMN "tagline" TEXT,
ADD COLUMN "bio" TEXT,
ADD COLUMN "years_of_experience" INTEGER,
ADD COLUMN "languages_spoken" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "gender" "ProviderGender";
