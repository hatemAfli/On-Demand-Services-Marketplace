-- Remove unused company dashboard theme setting
ALTER TABLE "companies" DROP COLUMN IF EXISTS "dashboard_theme";

DROP TYPE IF EXISTS "DashboardTheme";
