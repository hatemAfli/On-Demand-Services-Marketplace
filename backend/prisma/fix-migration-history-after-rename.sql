-- Run once on the database that shows drift (e.g. Supabase SQL editor, or `prisma db execute`).
--
-- Fixes:
-- 1) DB still records the old folder name `20260502143000_provider_tagline_bio_gender` (renamed on disk to `20260502080000_...`).
-- 2) `20260502083328_update_gender` was edited after apply — checksum must match current `migration.sql`.
--
-- Checksums are SHA256 of the exact migration.sql bytes (same algorithm Prisma uses).
-- Re-run `npx prisma migrate status` / `npx prisma migrate deploy` from `backend/` after this.

-- Rename applied migration row to match the migrations folder on disk
UPDATE "_prisma_migrations"
SET
  "migration_name" = '20260502080000_provider_tagline_bio_gender',
  "checksum" = 'c88f7d42d4a03f86dc0e5ae776f8e2e6d264ecac750fee4c685fda85f98ffc64'
WHERE "migration_name" = '20260502143000_provider_tagline_bio_gender';

-- Refresh checksum for edited migration (no-op on DB schema; only fixes Prisma history)
UPDATE "_prisma_migrations"
SET "checksum" = '09aae484318164c261fe50216ca7295ccdf8cacc8e8b6e6589fa6538e9b61685'
WHERE "migration_name" = '20260502083328_update_gender';
