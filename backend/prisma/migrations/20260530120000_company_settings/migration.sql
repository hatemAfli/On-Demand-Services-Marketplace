-- CreateEnum
CREATE TYPE "CompanyBranchStatus" AS ENUM ('OPERATIONAL', 'COMING_SOON', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CompanyAuditAction" AS ENUM ('PROFILE_UPDATED', 'BRANDING_UPDATED', 'BRANCH_CREATED', 'BRANCH_UPDATED', 'BRANCH_DELETED', 'NOTIFICATION_UPDATED', 'DATA_EXPORT');

-- CreateEnum
CREATE TYPE "DashboardTheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "companies"
ADD COLUMN "phone" TEXT,
ADD COLUMN "about" TEXT,
ADD COLUMN "brand_color" TEXT DEFAULT '#7621C2',
ADD COLUMN "dashboard_theme" "DashboardTheme" NOT NULL DEFAULT 'LIGHT';

-- CreateTable
CREATE TABLE "company_branches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "status" "CompanyBranchStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_notification_preferences" (
    "id" UUID NOT NULL,
    "company_admin_id" UUID NOT NULL,
    "new_order_alerts" BOOLEAN NOT NULL DEFAULT true,
    "provider_status_updates" BOOLEAN NOT NULL DEFAULT false,
    "weekly_report" BOOLEAN NOT NULL DEFAULT true,
    "system_announcements" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_admin_id" UUID,
    "action" "CompanyAuditAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_branches_company_id_idx" ON "company_branches"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_notification_preferences_company_admin_id_key" ON "company_notification_preferences"("company_admin_id");

-- CreateIndex
CREATE INDEX "company_audit_logs_company_id_created_at_idx" ON "company_audit_logs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "company_branches" ADD CONSTRAINT "company_branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_notification_preferences" ADD CONSTRAINT "company_notification_preferences_company_admin_id_fkey" FOREIGN KEY ("company_admin_id") REFERENCES "company_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_audit_logs" ADD CONSTRAINT "company_audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_audit_logs" ADD CONSTRAINT "company_audit_logs_actor_admin_id_fkey" FOREIGN KEY ("actor_admin_id") REFERENCES "company_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
