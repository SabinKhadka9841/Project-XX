-- Solo mode: a project with one member is a personal draft history.
--
-- Blocking people from approving their own work is right when there IS
-- someone else to ask. Alone, it's a dead end — you can raise a request
-- and then nothing on earth can ever approve it, so the final can never
-- change. That made solo projects unusable the moment the approval gate
-- landed.
--
-- The rule becomes: you can't approve your own work when there's
-- somebody else who could. On your own, you can, and the timeline
-- records honestly that you did it yourself.

create or replace function public.is_solo_project(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select count(*) = 1
  from members
  where members.project_id = p_project_id;
$$;

revoke all on function public.is_solo_project(uuid) from public;
grant execute on function public.is_solo_project(uuid) to authenticated;

drop policy if exists "members can decide requests they didn't author" on change_requests;
drop policy if exists "members can decide requests" on change_requests;
create policy "members can decide requests"
on change_requests for update
to authenticated
using (
  status = 'pending'
  and public.is_project_member(project_id)
  and (
    author_id is distinct from auth.uid()
    or public.is_solo_project(project_id)
  )
)
with check (
  status in ('approved', 'rejected')
  and reviewed_by = auth.uid()
);
