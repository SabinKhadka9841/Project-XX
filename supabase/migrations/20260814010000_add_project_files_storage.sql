-- Phase 0, file upload: a private Storage bucket for project files.
-- Files are stored at "<project_id>/<filename>", so the folder name
-- doubles as the project id — that's what the policies below check.

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

drop policy if exists "members can upload project files" on storage.objects;
create policy "members can upload project files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and exists (
    select 1 from members
    where members.project_id::text = (storage.foldername(name))[1]
    and members.user_id = auth.uid()
  )
);

drop policy if exists "members can view project files" on storage.objects;
create policy "members can view project files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-files'
  and exists (
    select 1 from members
    where members.project_id::text = (storage.foldername(name))[1]
    and members.user_id = auth.uid()
  )
);
