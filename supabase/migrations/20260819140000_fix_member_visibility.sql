-- Fix: you couldn't see your own teammates.
--
-- The members SELECT policy only ever allowed "user_id = auth.uid()",
-- i.e. your own membership row. Two consequences:
--
--   1. Nothing could list who's in a project.
--   2. The profiles policy checks membership by querying members — and
--      that subquery is itself subject to members' RLS, so it could
--      never find a teammate's row. Everyone showed up in the
--      contribution timeline as "Someone who has left".
--
-- Widening the members policy directly would make it query its own
-- table, which Postgres rejects as infinite recursion. The standard
-- way out is a SECURITY DEFINER function: it runs with the definer's
-- rights, so its internal read of members bypasses RLS and the
-- recursion never happens. search_path is pinned so the function
-- can't be tricked into resolving `members` to another schema.

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from members
    where members.project_id = p_project_id
    and members.user_id = auth.uid()
  );
$$;

create or replace function public.shares_a_project_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from members mine
    join members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid()
    and theirs.user_id = p_user_id
  );
$$;

revoke all on function public.is_project_member(uuid) from public;
revoke all on function public.shares_a_project_with(uuid) from public;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.shares_a_project_with(uuid) to authenticated;

-- Members of a project can now see everyone in it, not just themselves.
drop policy if exists "users can view their own memberships" on members;
drop policy if exists "members can view who else is in the project" on members;
create policy "members can view who else is in the project"
on members for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "see your own profile and your teammates'" on profiles;
create policy "see your own profile and your teammates'"
on profiles for select
to authenticated
using (
  id = auth.uid()
  or public.shares_a_project_with(id)
);
