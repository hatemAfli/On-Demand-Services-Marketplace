-- Track whether completion incremented GivenService.totalCompletedJobs (idempotent backfill).
ALTER TABLE "appointments"
ADD COLUMN "completed_jobs_counted" BOOLEAN NOT NULL DEFAULT false;
