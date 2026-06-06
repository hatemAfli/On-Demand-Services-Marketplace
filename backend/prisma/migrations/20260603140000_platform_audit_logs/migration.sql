-- CreateEnum
CREATE TYPE "PlatformAuditAction" AS ENUM (
  'USER_STATUS_UPDATED',
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VERIFICATION_UNDER_REVIEW',
  'VERIFICATION_DOCUMENT_REVIEWED',
  'APPOINTMENT_DISPUTED',
  'APPOINTMENT_INTERVENED',
  'COMPLAINT_REVIEWED',
  'REVIEW_HIDDEN',
  'REVIEW_RESTORED',
  'REVIEW_DELETED',
  'SERVICE_CATEGORY_CREATED',
  'SERVICE_CATEGORY_UPDATED',
  'SERVICE_CATEGORY_DELETED',
  'SERVICE_CREATED',
  'SERVICE_UPDATED',
  'SERVICE_DELETED',
  'LEGAL_DOCUMENT_CREATED',
  'LEGAL_DOCUMENT_UPDATED',
  'LEGAL_DOCUMENT_VERSION_ADDED',
  'LEGAL_DOCUMENT_PUBLISHED',
  'LEGAL_DOCUMENT_DELETED',
  'FAQ_CREATED',
  'FAQ_UPDATED',
  'FAQ_DELETED',
  'SUPPORT_MESSAGE_STATUS_UPDATED',
  'DATA_EXPORT'
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_admin_id" UUID,
  "action" "PlatformAuditAction" NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_action_created_at_idx" ON "platform_audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "platform_audit_logs"
  ADD CONSTRAINT "platform_audit_logs_actor_admin_id_fkey"
  FOREIGN KEY ("actor_admin_id") REFERENCES "platform_admins"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
