-- Company bootstrap: allow creating Company before linking CompanyAdmin.
-- Column name matches init migration (`"adminId"`), not snake_case.
ALTER TABLE "companies" ALTER COLUMN "adminId" DROP NOT NULL;

-- Company verification requests have no catalog service.
ALTER TABLE "verification_profil_requests" DROP CONSTRAINT IF EXISTS "verification_profil_requests_service_id_fkey";
ALTER TABLE "verification_profil_requests" ALTER COLUMN "service_id" DROP NOT NULL;
ALTER TABLE "verification_profil_requests" ADD CONSTRAINT "verification_profil_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
