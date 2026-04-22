-- Run in Supabase SQL editor (or psql) after creating the bucket.
--
-- 1) Dashboard → Storage → New bucket
--    Name: service_photos
--    Public bucket: ON (so getPublicUrl() works for catalog images)
--
-- 2) Or insert manually:
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'service_photos',
--   'service_photos',
--   true,
--   5242880,
--   array['image/jpeg','image/png','image/webp','image/gif']::text[]
-- );

-- Policies apply to table storage.objects (Supabase Storage API).

-- Anyone can read objects (public catalog images).
drop policy if exists "service_photos_public_read" on storage.objects;
create policy "service_photos_public_read"
on storage.objects for select
using (bucket_id = 'service_photos');

-- Logged-in users (e.g. platform admins via Supabase Auth) can upload.
drop policy if exists "service_photos_authenticated_insert" on storage.objects;
create policy "service_photos_authenticated_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'service_photos');

-- Allow authenticated users to replace/update/delete objects (re-upload photo).
drop policy if exists "service_photos_authenticated_update" on storage.objects;
create policy "service_photos_authenticated_update"
on storage.objects for update
to authenticated
using (bucket_id = 'service_photos')
with check (bucket_id = 'service_photos');

drop policy if exists "service_photos_authenticated_delete" on storage.objects;
create policy "service_photos_authenticated_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'service_photos');
