-- Attribution needs readable names.
--
-- Everything so far stores user ids, but auth.users isn't readable from
-- the app — so a contribution timeline could only say
-- "f09c7de7-22bb... asked to add this in", which is useless.
--
-- A profiles table mirrors just the email out of auth.users, kept in
-- sync by a trigger, and is readable only by people who actually share
-- a project with you. Emails are personal data; this deliberately does
-- not let any signed-in user enumerate every address in the system.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "see your own profile and your teammates'" on profiles;
create policy "see your own profile and your teammates'"
on profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from members mine
    join members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid()
    and theirs.user_id = profiles.id
  )
);

-- Kept current by the database itself rather than by app code, so a
-- profile can't go missing just because someone signed up through a
-- path we forgot to update.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who signed up before this migration existed.
insert into profiles (id, email)
select id, email from auth.users
where email is not null
on conflict (id) do nothing;
