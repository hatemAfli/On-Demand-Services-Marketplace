-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "confirmed_at" TIMESTAMP(3);

-- Backfill for appointments already confirmed or further along
UPDATE "appointments"
SET "confirmed_at" = "updated_at"
WHERE "status" IN (
  'CONFIRMED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED_CLIENT',
  'CANCELLED_PROVIDER',
  'DISPUTED'
);
