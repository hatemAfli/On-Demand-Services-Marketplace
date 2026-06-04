-- CreateEnum
CREATE TYPE "ComplaintForwardTarget" AS ENUM ('PLATFORM', 'COMPANY', 'BOTH');

-- AlterTable
ALTER TABLE "complaints" ADD COLUMN "forward_target" "ComplaintForwardTarget" NOT NULL DEFAULT 'PLATFORM';
ALTER TABLE "complaints" ADD COLUMN "company_id" UUID;
ALTER TABLE "complaints" ADD COLUMN "company_notes" TEXT;
ALTER TABLE "complaints" ADD COLUMN "company_response" TEXT;
ALTER TABLE "complaints" ADD COLUMN "company_reviewed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "complaints_company_id_status_idx" ON "complaints"("company_id", "status");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
