-- Phase 1: "ask to add this in".
--
-- A change request says "please put my copy's version of these files
-- into the final". Nothing moves until a teammate approves it — that
-- approval gate is what makes the contribution log fall out for free
-- later, so this table is the spine of the whole product.
--
-- In the UI this is never called a merge request or a pull request:
-- it's "ask to add this in".

create table if not exists change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_branch_id uuid not null references branches(id) on delete cascade,
  target_branch_id uuid not null references branches(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- You can't ask twice for the same copy while the first ask is still
-- waiting. Without this, a double-clicked button silently creates two
-- competing requests for identical changes.
create unique index if not exists change_requests_one_pending_per_source
  on change_requests (source_branch_id)
  where status = 'pending';

create index if not exists change_requests_project_idx
  on change_requests (project_id, created_at desc);

alter table change_requests enable row level security;

drop policy if exists "members can view change requests" on change_requests;
create policy "members can view change requests"
on change_requests for select
to authenticated
using (
  exists (
    select 1 from members
    where members.project_id = change_requests.project_id
    and members.user_id = auth.uid()
  )
);

-- You may only raise a request in your own name, and only in a project
-- you belong to. Approving/rejecting is a separate change, so there is
-- deliberately no update policy yet — nothing can leave 'pending'.
drop policy if exists "members can raise change requests" on change_requests;
create policy "members can raise change requests"
on change_requests for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from members
    where members.project_id = change_requests.project_id
    and members.user_id = auth.uid()
  )
);
