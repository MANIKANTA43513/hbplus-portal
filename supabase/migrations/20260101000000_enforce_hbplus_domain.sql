-- =============================================================================
-- Server-side enforcement of the "hbplus.fit" email-domain restriction.
--
-- The app also checks the domain in the client, but a client can be modified.
-- These database objects are the real boundary:
--   1. A trigger on auth.users refuses to create or change a user to any address
--      outside the exact domain, so non-company accounts never get a session.
--   2. Row Level Security on public.profiles only returns data to a signed-in,
--      Google-authenticated, email-confirmed user whose address is on the domain.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL Editor.
-- To change the allowed domain, replace every 'hbplus.fit' below.
-- =============================================================================

-- 1. Reject sign-ups / email changes outside the allowed domain ---------------

create or replace function public.enforce_allowed_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(btrim(coalesce(new.email, '')));
  at_signs   int  := length(normalized) - length(replace(normalized, '@', ''));
begin
  -- Exact comparison of the whole domain: exactly one "@", a non-empty local part,
  -- and a domain equal to 'hbplus.fit'. Rejects sub.hbplus.fit, not-hbplus.fit and
  -- hbplus.fit.attacker.com.
  if at_signs <> 1
     or split_part(normalized, '@', 1) = ''
     or split_part(normalized, '@', 2) <> 'hbplus.fit' then
    raise exception 'Access restricted. Please login using your official domain email.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_allowed_email_domain() from public, anon, authenticated;

drop trigger if exists enforce_allowed_email_domain_on_insert on auth.users;
create trigger enforce_allowed_email_domain_on_insert
  before insert on auth.users
  for each row execute function public.enforce_allowed_email_domain();

drop trigger if exists enforce_allowed_email_domain_on_update on auth.users;
create trigger enforce_allowed_email_domain_on_update
  before update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.enforce_allowed_email_domain();

-- 2. Authorization helper used by Row Level Security --------------------------
-- Reads the identity from auth.users (server-owned) rather than from the JWT's
-- user_metadata, which a user can edit. Requires: exact domain, confirmed email,
-- and the Google provider.

create or replace function public.is_authorized_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and split_part(lower(btrim(u.email)), '@', 2) = 'hbplus.fit'
      and split_part(lower(btrim(u.email)), '@', 1) <> ''
      and (length(lower(btrim(u.email))) - length(replace(lower(btrim(u.email)), '@', ''))) = 1
      and u.raw_app_meta_data ->> 'provider' = 'google'
  );
$$;

revoke all on function public.is_authorized_member() from public, anon;
grant execute on function public.is_authorized_member() to authenticated;

-- 3. Example protected data: one profile row per member ------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Authorized members can read their own profile" on public.profiles;
create policy "Authorized members can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    and (select public.is_authorized_member())
  );

-- No insert/update/delete policies exist, so clients cannot write to this table.
-- Rows are created by the trigger below, which only runs for users who passed step 1.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(btrim(new.email)),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Clean up any pre-existing users that are outside the domain ---------------
-- Existing rows are not affected by the triggers above. They are already denied by the
-- RLS policy and by the app, but removing them is tidier. Review before running:
--
--   delete from auth.users
--   where split_part(lower(btrim(email)), '@', 2) <> 'hbplus.fit';
