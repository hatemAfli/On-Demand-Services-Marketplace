-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
--
-- Bucket name: appointment-request-photos
-- Purpose: images a client attaches when submitting a booking request (shown to the provider).
--
-- 1) Dashboard → Storage → New bucket
--    Name: appointment-request-photos
--    Public bucket: ON (providers load images via public URLs stored on appointments.photo_urls)
--    File size limit: 5242880 (5 MB)
--    Allowed MIME types: image/jpeg, image/png, image/webp
--
-- 2) Or insert manually:
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'appointment-request-photos',
--   'appointment-request-photos',
--   true,
--   5242880,
--   array['image/jpeg','image/png','image/webp']::text[]
-- );
--
-- Object path (mobile app):
--   clients/<auth.uid()>/batches/<batchId>/<timestamp-rand>.<ext>

drop policy if exists "appointment_request_photos_public_read" on storage.objects;
create policy "appointment_request_photos_public_read"
on storage.objects for select
to public
using (bucket_id = 'appointment-request-photos');

drop policy if exists "appointment_request_photos_client_insert" on storage.objects;
create policy "appointment_request_photos_client_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'appointment-request-photos'
  and split_part(name, '/', 1) = 'clients'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) = 'batches'
);

drop policy if exists "appointment_request_photos_client_update" on storage.objects;
create policy "appointment_request_photos_client_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'appointment-request-photos'
  and split_part(name, '/', 1) = 'clients'
  and split_part(name, '/', 2) = auth.uid()::text
)
with check (
  bucket_id = 'appointment-request-photos'
  and split_part(name, '/', 1) = 'clients'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "appointment_request_photos_client_delete" on storage.objects;
create policy "appointment_request_photos_client_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'appointment-request-photos'
  and split_part(name, '/', 1) = 'clients'
  and split_part(name, '/', 2) = auth.uid()::text
);
