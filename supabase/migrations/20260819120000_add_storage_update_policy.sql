-- Fix: uploading with upsert (replacing an existing file) needs UPDATE
-- permission on storage.objects, not just INSERT. Only INSERT and
-- SELECT policies existed, so overwriting a file as a real member (not
-- via the service-role key) has been silently broken since file upload
-- was first built — it only ever worked through the OnlyOffice save
-- callback, which bypasses RLS with the service role key. Caught while
-- testing approve, which overwrites the final's files as a normal
-- signed-in member.

drop policy if exists "members can replace project files" on storage.objects;
create policy "members can replace project files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-files'
  and exists (
    select 1 from members
    where members.project_id::text = (storage.foldername(name))[1]
    and members.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'project-files'
  and exists (
    select 1 from members
    where members.project_id::text = (storage.foldername(name))[1]
    and members.user_id = auth.uid()
  )
);
