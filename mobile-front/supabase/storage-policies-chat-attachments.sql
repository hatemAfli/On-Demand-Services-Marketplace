-- Run in Supabase Dashboard → SQL → New query (after creating the bucket).
-- Canonical copy: backend/supabase/storage-chat-attachments-policies.sql
--
-- Bucket: chat-attachments
-- Path: conversations/<conversationId>/<auth.uid()>/<file>

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
