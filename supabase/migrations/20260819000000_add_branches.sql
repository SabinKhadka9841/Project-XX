-- Phase 1: copies.
--
-- Every project now has one protected "final" version, plus zero or more
-- copies people can change freely. Internally these are all rows in the
-- same table — the only difference is the is_final flag.
--
-- Files move from  <project_id>/<filename>
--             to   <project_id>/<branch_id>/<filename>
-- The existing storage policies check (storage.foldername(name))[1],
-- which is still the project id either way, so they keep working
-- unchanged.

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  is_final boolean not null default false,
  created_at timestamptz not null default now()
);

-- A project must never end up with two "final" versions.
create unique index if not exists branches_one_final_per_project
  on branches (project_id)
  where is_final;

alter table branches enable row level security;

drop policy if exists "members can view branches" on branches;
create policy "members can view branches"
on branches for select
to authenticated
using (
  exists (
    select 1 from members
    where members.project_id = branches.project_id
    and members.user_id = auth.uid()
  )
);

drop policy if exists "members can create branches" on branches;
create policy "members can create branches"
on branches for insert
to authenticated
with check (
  exists (
    select 1 from members
    where members.project_id = branches.project_id
    and members.user_id = auth.uid()
  )
);

-- Give every project that already exists a final version, so nothing is
-- left in a half-migrated state.
insert into branches (project_id, name, is_final)
select projects.id, 'The final', true
from projects
where not exists (
  select 1 from branches
  where branches.project_id = projects.id
  and branches.is_final
);
