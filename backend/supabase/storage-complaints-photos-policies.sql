-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
--
-- Bucket name: complaints_photos
-- Purpose: client evidence photos when filing a complaint (read by client,
--           targeted provider, and platform/company admins via public URLs on complaints.evidence_urls).
--
-- 1) Dashboard → Storage → New bucket
--    Name: complaints_photos
--    Public bucket: ON (mobile/web load images via getPublicUrl URLs)
--    File size limit: 5242880 (5 MB)
--    Allowed MIME types: image/jpeg, image/png, image/webp
--
-- 2) Or insert manually:
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'complaints_photos',
--   'complaints_photos',
--   true,
--   5242880,
--   array['image/jpeg','image/png','image/webp']::text[]
-- );
--
-- Object path (mobile app):
--   appointments/<appointmentId>/clients/<auth.uid()>/evidence/<batchId>/<timestamp-rand>.<ext>
--
-- Note: clients.id and providers.id equal Supabase auth user id (users.id).
-- complaints.appointment_id / client_id / provider_id reference those rows.

-- ---------------------------------------------------------------------------
-- Read (SELECT)
-- ---------------------------------------------------------------------------

drop policy if exists "complaints_photos_public_read" on storage.objects;
create policy "complaints_photos_public_read"
on storage.objects for select
to public
using (bucket_id = 'complaints_photos');

drop policy if exists "complaints_photos_client_read" on storage.objects;
create policy "complaints_photos_client_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'complaints_photos'
  and split_part(name, '/', 1) = 'appointments'
  and split_part(name, '/', 3) = 'clients'
  and split_part(name, '/', 4) = auth.uid()::text
);

drop policy if exists "complaints_photos_provider_read" on storage.objects;
create policy "complaints_photos_provider_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'complaints_photos'
  and split_part(name, '/', 1) = 'appointments'
  and exists (
    select 1
    from public.complaints c
    where c.appointment_id::text = split_part(name, '/', 2)
      and c.provider_id = auth.uid()
  )
);

drop policy if exists "complaints_photos_admin_read" on storage.objects;
create policy "complaints_photos_admin_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'complaints_photos'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('PLATFORM_ADMIN', 'COMPANY_ADMIN')
  )
);

-- ---------------------------------------------------------------------------
-- Write (client uploads only, before/during complaint filing)
-- ---------------------------------------------------------------------------

drop policy if exists "complaints_photos_client_insert" on storage.objects;
create policy "complaints_photos_client_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'complaints_photos'
  and split_part(name, '/', 1) = 'appointments'
  and split_part(name, '/', 3) = 'clients'
  and split_part(name, '/', 4) = auth.uid()::text
  and split_part(name, '/', 5) = 'evidence'
);

drop policy if exists "complaints_photos_client_update" on storage.objects;
create policy "complaints_photos_client_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'complaints_photos'
  and split_part(name, '/', 1) = 'appointments'
  and split_part(name, '/', 3) = 'clients'
  and split_part(name, '/', 4) = auth.uid()::text
)
with check (
  bucket_id = 'complaints_photos'
  and split_part(name, '/', 1) = 'appointments'
  and split_part(name, '/', 3) = 'clients'
  and split_part(name, '/', 4) = auth.uid()::text
);

drop policy if exists "complaints_photos_client_delete" on storage.objects;
create policy "complaints_photos_client_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'complaints_photos'
  and split_part(name, '/', 1) = 'appointments'
  and split_part(name, '/', 3) = 'clients'
  and split_part(name, '/', 4) = auth.uid()::text
);
