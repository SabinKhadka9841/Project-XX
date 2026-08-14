-- Phase 0, Prompt 3: projects and members only.
-- No snapshots, blobs or branches yet — those come in Phase 1.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deadline timestamptz,
  org_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  primary key (project_id, user_id)
);

-- Lock both tables down until real access policies are written (Prompt 4+).
-- With RLS on and no policies, the API can't read or write any row.
alter table projects enable row level security;
alter table members enable row level security;

-- Phase 0, Prompt 5: real access rules, now that /projects needs to
-- read and create rows. "drop policy if exists" first so this file can
-- be re-run safely without erroring on already-existing policies.

drop policy if exists "signed-in users can create projects" on projects;
create policy "signed-in users can create projects"
on projects for insert
to authenticated
with check (true);

drop policy if exists "members can view their projects" on projects;
create policy "members can view their projects"
on projects for select
to authenticated
using (
  exists (
    select 1 from members
    where members.project_id = projects.id
    and members.user_id = auth.uid()
  )
);

drop policy if exists "users can add themselves as a member" on members;
create policy "users can add themselves as a member"
on members for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can view their own memberships" on members;
create policy "users can view their own memberships"
on members for select
to authenticated
using (user_id = auth.uid());
