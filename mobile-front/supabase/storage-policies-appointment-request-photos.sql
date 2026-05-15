-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
-- Canonical copy: backend/supabase/storage-appointment-request-photos-policies.sql
--
-- Bucket: appointment-request-photos
-- Path: clients/<auth.uid()>/batches/<batchId>/<file>

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
