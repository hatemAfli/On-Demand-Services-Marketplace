-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
--
-- Bucket name: appointment-intervention-photos
-- Purpose: provider before/after photos during service execution (platform admin,
--           company admin, and client view via URLs on appointments.before_photo_urls /
--           appointments.after_photo_urls).
--
-- 1) Dashboard → Storage → New bucket
--    Name: appointment-intervention-photos
--    Public bucket: ON
--    File size limit: 5242880 (5 MB)
--    Allowed MIME types: image/jpeg, image/png, image/webp
--
-- 2) Or insert manually:
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'appointment-intervention-photos',
--   'appointment-intervention-photos',
--   true,
--   5242880,
--   array['image/jpeg','image/png','image/webp']::text[]
-- );
--
-- Object path (mobile app):
--   providers/<auth.uid()>/appointments/<appointmentId>/before/<file>
--   providers/<auth.uid()>/appointments/<appointmentId>/after/<file>
--
-- Note: Provider.id equals Supabase auth user id (same as users.id).

drop policy if exists "appointment_intervention_photos_public_read" on storage.objects;
create policy "appointment_intervention_photos_public_read"
on storage.objects for select
to public
using (bucket_id = 'appointment-intervention-photos');

drop policy if exists "appointment_intervention_photos_provider_insert" on storage.objects;
create policy "appointment_intervention_photos_provider_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'appointment-intervention-photos'
  and split_part(name, '/', 1) = 'providers'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) = 'appointments'
  and split_part(name, '/', 5) in ('before', 'after')
);

drop policy if exists "appointment_intervention_photos_provider_update" on storage.objects;
create policy "appointment_intervention_photos_provider_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'appointment-intervention-photos'
  and split_part(name, '/', 1) = 'providers'
  and split_part(name, '/', 2) = auth.uid()::text
)
with check (
  bucket_id = 'appointment-intervention-photos'
  and split_part(name, '/', 1) = 'providers'
  and split_part(name, '/', 2) = auth.uid()::text
);

drop policy if exists "appointment_intervention_photos_provider_delete" on storage.objects;
create policy "appointment_intervention_photos_provider_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'appointment-intervention-photos'
  and split_part(name, '/', 1) = 'providers'
  and split_part(name, '/', 2) = auth.uid()::text
);
