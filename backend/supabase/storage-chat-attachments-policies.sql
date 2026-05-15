-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
--
-- Bucket name: chat-attachments
-- Purpose: images sent in client ↔ provider conversations (isolated from `gallery`).
--
-- 1) Dashboard → Storage → New bucket
--    Name: chat-attachments
--    Public bucket: ON (message UI loads images via public URLs in messages.media_urls)
--    File size limit: 5242880 (5 MB)
--    Allowed MIME types: image/jpeg, image/png, image/webp
--
-- 2) Or insert manually:
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values (
--   'chat-attachments',
--   'chat-attachments',
--   true,
--   5242880,
--   array['image/jpeg','image/png','image/webp']::text[]
-- );
--
-- Object path (mobile app):
--   conversations/<conversationId>/<auth.uid()>/<timestamp-rand>.<ext>

drop policy if exists "chat_attachments_public_read" on storage.objects;
create policy "chat_attachments_public_read"
on storage.objects for select
to public
using (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_participant_insert" on storage.objects;
create policy "chat_attachments_participant_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = 'conversations'
  and split_part(name, '/', 3) = auth.uid()::text
);

drop policy if exists "chat_attachments_participant_update" on storage.objects;
create policy "chat_attachments_participant_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = 'conversations'
  and split_part(name, '/', 3) = auth.uid()::text
)
with check (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = 'conversations'
  and split_part(name, '/', 3) = auth.uid()::text
);

drop policy if exists "chat_attachments_participant_delete" on storage.objects;
create policy "chat_attachments_participant_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = 'conversations'
  and split_part(name, '/', 3) = auth.uid()::text
);
