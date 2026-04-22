-- One VerificationProfilRequest has many Documents (single admin decision per submission).
-- Clears existing verification rows (re-seed `services` if needed).

ALTER TABLE "verification_profil_requests" DROP CONSTRAINT IF EXISTS "verification_profil_requests_document_id_fkey";

DELETE FROM "verification_profil_requests";
DELETE FROM "documents";

DROP INDEX IF EXISTS "verification_profil_requests_document_id_idx";

ALTER TABLE "verification_profil_requests" DROP COLUMN IF EXISTS "document_id";

ALTER TABLE "documents" ADD COLUMN "verification_request_id" UUID NOT NULL;

ALTER TABLE "documents" ADD CONSTRAINT "documents_verification_request_id_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "verification_profil_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "documents_verification_request_id_idx" ON "documents"("verification_request_id");
