-- Run this in Supabase Dashboard → SQL → New query → Run
-- Fixes: "new row violates row-level security policy" on Storage upload
--
-- App uploads to bucket: avatars
-- Object name (path inside bucket): avatars/<auth.uid()>/profile.<jpg|png|webp>
--
-- Prerequisites:
-- - Bucket `avatars` exists (Storage → Create bucket if needed)
-- - Upload uses the logged-in Supabase user JWT (Expo app does this by default)

-- Idempotent: drop our policies by name, then recreate
DROP POLICY IF EXISTS "avatars_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_public_read" ON storage.objects;

-- Authenticated users may INSERT only into their own folder (second path segment = auth.uid())
CREATE POLICY "avatars_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- UPSERT / overwrite same key needs UPDATE
CREATE POLICY "avatars_update_own_folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = 'avatars'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- Allow public URLs (getPublicUrl) to work for the avatars bucket
-- Remove this policy if you switch to signed URLs only.
CREATE POLICY "avatars_select_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
