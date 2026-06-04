ALTER TABLE "companies"
ADD COLUMN "cancellation_rate" DECIMAL(5,2) DEFAULT 0,
ADD COLUMN "average_response_time" DECIMAL(10,2);

ALTER TABLE "appointments"
ADD COLUMN "company_responded_at" TIMESTAMP(3);

UPDATE "appointments"
SET "company_responded_at" = "confirmed_at"
WHERE "company_id" IS NOT NULL
  AND "confirmed_at" IS NOT NULL
  AND "company_responded_at" IS NULL;

UPDATE "appointments"
SET "company_responded_at" = "updated_at"
WHERE "company_id" IS NOT NULL
  AND "company_responded_at" IS NULL
  AND "status" IN ('REFUSED', 'RESCHEDULED');
