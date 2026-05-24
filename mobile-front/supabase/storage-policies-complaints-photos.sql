-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
-- Canonical copy: backend/supabase/storage-complaints-photos-policies.sql
--
-- Bucket: complaints_photos
-- Path: appointments/<appointmentId>/clients/<auth.uid()>/evidence/<batchId>/<file>

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
