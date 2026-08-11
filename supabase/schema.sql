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
