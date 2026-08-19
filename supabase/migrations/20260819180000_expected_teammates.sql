-- Knowing who hasn't joined yet.
--
-- Invites are links, so nothing records that one was sent. You can see
-- who joined but not who ignored it — and chasing that last person is
-- exactly what the pilot's success measure turns on ("the percentage of
-- groups where every single member signed up").
--
-- So: optionally note down who you're expecting. Purely a checklist —
-- it grants nothing, blocks nothing, and joining still works by link
-- for anyone, whether or not they were listed. Making the list
-- authoritative would mean a teammate who used a different email
-- address gets locked out, which is exactly the friction that sends a
-- group back to WhatsApp.

create table if not exists expected_teammates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Case-insensitive, since nobody types their address consistently.
create unique index if not exists expected_teammates_unique_email
  on expected_teammates (project_id, lower(email));

create index if not exists expected_teammates_project_idx
  on expected_teammates (project_id);

alter table expected_teammates enable row level security;

drop policy if exists "members can view expected teammates" on expected_teammates;
create policy "members can view expected teammates"
on expected_teammates for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "members can add expected teammates" on expected_teammates;
create policy "members can add expected teammates"
on expected_teammates for insert
to authenticated
with check (public.is_project_member(project_id));

-- Removable, because a mistyped address would otherwise sit there
-- looking like a teammate who never showed up.
drop policy if exists "members can remove expected teammates" on expected_teammates;
create policy "members can remove expected teammates"
on expected_teammates for delete
to authenticated
using (public.is_project_member(project_id));
