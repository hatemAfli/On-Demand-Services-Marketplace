-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "is_accepted" BOOLEAN,
ADD COLUMN     "rejection_reason" TEXT;

-- Backfill: historically validated files count as admin-accepted
UPDATE "documents" SET "is_accepted" = true WHERE "validated_at" IS NOT NULL;
