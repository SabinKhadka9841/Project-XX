-- Onboarding: show people what they're being invited to *before*
-- asking them to sign in.
--
-- Until now an invite link led to a bare email box. Someone who's never
-- heard of this tool sees a login form with no context, and the least
-- motivated person in the group closes the tab and says "just email it
-- to me" — which the plan names as the real competitor.
--
-- Reading the project normally is blocked by RLS (you must already be a
-- member), and that's correct. This exposes exactly one thing — the
-- project's name — to whoever holds the link.
--
-- Why that's safe: the project id IS the invite secret. It's a random
-- UUID, and anyone holding it can already join the project outright.
-- Learning the name is strictly less than what the link already grants.
-- Nothing else is exposed: no files, no members, no deadline.

create or replace function public.invite_preview(p_project_id uuid)
returns table (name text)
language sql
security definer
stable
set search_path = public
as $$
  select projects.name
  from projects
  where projects.id = p_project_id;
$$;

revoke all on function public.invite_preview(uuid) from public;
grant execute on function public.invite_preview(uuid) to anon, authenticated;
