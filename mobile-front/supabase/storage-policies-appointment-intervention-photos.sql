-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
-- Canonical copy: backend/supabase/storage-appointment-intervention-photos-policies.sql
--
-- Bucket: appointment-intervention-photos
-- Path: providers/<providerUserId>/appointments/<appointmentId>/before|after/<file>

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
