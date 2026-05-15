-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('SERVICE_QUALITY', 'NO_SHOW', 'LATE_ARRIVAL', 'UNPROFESSIONAL', 'OVERCHARGING', 'PROPERTY_DAMAGE', 'SAFETY_CONCERN', 'FRAUD', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintDecision" AS ENUM ('WARNING_ISSUED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'REFUND_ISSUED', 'NO_ACTION', 'FORWARDED_TO_COMPANY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_FILED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_STATUS_UPDATED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_RESOLVED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPLAINT_DISMISSED';

-- AlterTable
ALTER TABLE "providers" ADD COLUMN "total_complaints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "active_complaints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "handled_by_admin_id" UUID,
    "admin_notes" TEXT,
    "admin_response" TEXT,
    "decision" "ComplaintDecision",
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "target_is_employee" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "complaints_appointment_id_client_id_key" ON "complaints"("appointment_id", "client_id");

-- CreateIndex
CREATE INDEX "complaints_status_created_at_idx" ON "complaints"("status", "created_at");

-- CreateIndex
CREATE INDEX "complaints_provider_id_status_idx" ON "complaints"("provider_id", "status");

-- CreateIndex
CREATE INDEX "complaints_client_id_idx" ON "complaints"("client_id");

-- CreateIndex
CREATE INDEX "complaints_handled_by_admin_id_idx" ON "complaints"("handled_by_admin_id");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_handled_by_admin_id_fkey" FOREIGN KEY ("handled_by_admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
