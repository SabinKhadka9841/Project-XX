-- Tenancy: org_id on every table holding project data.
--
-- The plan is explicit that this goes on every such table from the
-- first migration, because universities will want tenancy isolation and
-- regional data residency, and retrofitting is painful while doing it
-- early is free. Only `projects` ever got the column; everything added
-- since (members, branches, change_requests, expected_teammates) drifted
-- from that rule, and each new table widened the gap.
--
-- Doing it now, while these tables hold a handful of rows, costs
-- nothing. Doing it once a pilot has real data means a backfill over
-- live rows plus a careful rewrite of every policy at the same time.
--
-- Deliberately NOT added to `profiles`. A person isn't owned by one
-- organisation — the same student can be in projects belonging to
-- different ones — so stamping a single org_id on them would be wrong
-- rather than merely absent.
--
-- No orgs table and no foreign key yet, matching how projects.org_id
-- has always been: the column is reserved and kept correct, and the
-- isolation policies come when there's actually something to isolate.
-- Adding a column now is the cheap half; that was the point.

alter table members add column if not exists org_id uuid;
alter table branches add column if not exists org_id uuid;
alter table change_requests add column if not exists org_id uuid;
alter table expected_teammates add column if not exists org_id uuid;

-- Kept correct by the database rather than by remembering to set it in
-- every insert across the app — app code that has to remember is app
-- code that eventually forgets.
create or replace function public.inherit_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select projects.org_id into new.org_id
    from projects
    where projects.id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_org_id on members;
create trigger set_org_id before insert or update of project_id on members
  for each row execute function public.inherit_org_id();

drop trigger if exists set_org_id on branches;
create trigger set_org_id before insert or update of project_id on branches
  for each row execute function public.inherit_org_id();

drop trigger if exists set_org_id on change_requests;
create trigger set_org_id before insert or update of project_id on change_requests
  for each row execute function public.inherit_org_id();

drop trigger if exists set_org_id on expected_teammates;
create trigger set_org_id before insert or update of project_id on expected_teammates
  for each row execute function public.inherit_org_id();

-- If a project ever moves organisation, its rows follow rather than
-- silently keeping the old one.
create or replace function public.cascade_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is distinct from old.org_id then
    update members set org_id = new.org_id where project_id = new.id;
    update branches set org_id = new.org_id where project_id = new.id;
    update change_requests set org_id = new.org_id where project_id = new.id;
    update expected_teammates set org_id = new.org_id where project_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists cascade_org_id on projects;
create trigger cascade_org_id after update of org_id on projects
  for each row execute function public.cascade_org_id();

-- Existing rows. Everything is currently null (no organisations exist
-- yet), but this is what makes the column trustworthy rather than
-- merely present.
update members set org_id = projects.org_id
  from projects where projects.id = members.project_id
  and members.org_id is distinct from projects.org_id;

update branches set org_id = projects.org_id
  from projects where projects.id = branches.project_id
  and branches.org_id is distinct from projects.org_id;

update change_requests set org_id = projects.org_id
  from projects where projects.id = change_requests.project_id
  and change_requests.org_id is distinct from projects.org_id;

update expected_teammates set org_id = projects.org_id
  from projects where projects.id = expected_teammates.project_id
  and expected_teammates.org_id is distinct from projects.org_id;

-- Filtering by tenant is the whole reason the column exists.
create index if not exists members_org_idx on members (org_id);
create index if not exists branches_org_idx on branches (org_id);
create index if not exists change_requests_org_idx on change_requests (org_id);
create index if not exists expected_teammates_org_idx on expected_teammates (org_id);
create index if not exists projects_org_idx on projects (org_id);
