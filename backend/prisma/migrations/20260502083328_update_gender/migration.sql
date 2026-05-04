/*
  Warnings:

  - The values [OTHER,PREFER_NOT_TO_SAY] on the enum `ProviderGender` will be removed. If these variants are still used in the database, this will fail.

*/
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
