-- Phase 3: deadlines, and locking the final once one passes.
--
-- projects.deadline has existed since the first migration but nothing
-- ever set or respected it. Now: once the deadline passes, the final
-- stops accepting changes, so nobody can quietly alter a submission
-- after it was due — including by approving a change request, which
-- writes to the final's files.
--
-- Copies stay editable on purpose. Locking those would just destroy
-- work in progress; the thing that needs protecting is the submitted
-- version.
--
-- Honest about what this is: a guardrail against accidents, not a
-- security control. Any member can change the deadline (see the update
-- policy below), so a determined person can unlock it. That's the right
-- trade for a group of peers — the failure being designed against is
-- "someone opened the wrong file the night before marking", not fraud.

create or replace function public.is_project_locked(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from projects
    where projects.id = p_project_id
    and projects.deadline is not null
    and projects.deadline < now()
  );
$$;

-- True when a storage path points at the final version of a project
-- whose deadline has passed.
create or replace function public.is_locked_final_path(p_name text)
returns boolean
language sql
security definer
stable
set search_path = public, storage
as $$
  select exists (
    select 1
    from branches
    join projects on projects.id = branches.project_id
    where branches.project_id::text = (storage.foldername(p_name))[1]
    and branches.id::text = (storage.foldername(p_name))[2]
    and branches.is_final
    and projects.deadline is not null
    and projects.deadline < now()
  );
$$;

revoke all on function public.is_project_locked(uuid) from public;
revoke all on function public.is_locked_final_path(text) from public;
grant execute on function public.is_project_locked(uuid) to authenticated;
grant execute on function public.is_locked_final_path(text) to authenticated;

-- Members can edit the project itself (in practice: set the deadline).
-- There was no update policy at all before, so nothing could.
drop policy if exists "members can update their project" on projects;
create policy "members can update their project"
on projects for update
to authenticated
using (public.is_project_member(id))
with check (public.is_project_member(id));

-- Rebuild both storage write policies with the lock check added.
drop policy if exists "members can upload project files" on storage.objects;
create policy "members can upload project files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and not public.is_locked_final_path(name)
  and exists (
    select 1 from members
    where members.project_id::text = (storage.foldername(name))[1]
    and members.user_id = auth.uid()
  )
);

drop policy if exists "members can replace project files" on storage.objects;
create policy "members can replace project files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-files'
  and not public.is_locked_final_path(name)
  and exists (
    select 1 from members
    where members.project_id::text = (storage.foldername(name))[1]
    and members.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'project-files'
  and not public.is_locked_final_path(name)
  and exists (
    select 1 from members
    where members.project_id::text = (storage.foldername(name))[1]
    and members.user_id = auth.uid()
  )
);

-- Deciding a request after the deadline would change the final, so
-- block that too rather than letting it fail halfway through copying
-- files.
drop policy if exists "members can decide requests" on change_requests;
create policy "members can decide requests"
on change_requests for update
to authenticated
using (
  status = 'pending'
  and public.is_project_member(project_id)
  and not public.is_project_locked(project_id)
  and (
    author_id is distinct from auth.uid()
    or public.is_solo_project(project_id)
  )
)
with check (
  status in ('approved', 'rejected')
  and reviewed_by = auth.uid()
);
