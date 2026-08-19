-- Phase 1: approving (or rejecting) a change request.
--
-- Deliberately no policy lets someone decide their own request — the
-- whole point of the approval gate is that a teammate signs off, not
-- the person who made the change. WITH CHECK pins reviewed_by to the
-- actor's own id, so nobody can record someone else as having approved
-- it.

alter table change_requests
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

drop policy if exists "members can decide requests they didn't author" on change_requests;
create policy "members can decide requests they didn't author"
on change_requests for update
to authenticated
using (
  status = 'pending'
  and author_id is distinct from auth.uid()
  and exists (
    select 1 from members
    where members.project_id = change_requests.project_id
    and members.user_id = auth.uid()
  )
)
with check (
  status in ('approved', 'rejected')
  and reviewed_by = auth.uid()
);
