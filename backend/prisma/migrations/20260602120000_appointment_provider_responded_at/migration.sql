-- Track when an independent provider first responded to a booking request.
ALTER TABLE "appointments" ADD COLUMN "provider_responded_at" TIMESTAMP(3);

-- Backfill from existing data (best-effort).
UPDATE "appointments"
SET "provider_responded_at" = "confirmed_at"
WHERE "confirmed_at" IS NOT NULL
  AND "provider_responded_at" IS NULL;

UPDATE "appointments"
SET "provider_responded_at" = "updated_at"
WHERE "provider_responded_at" IS NULL
  AND "status" IN ('REFUSED', 'RESCHEDULED');
