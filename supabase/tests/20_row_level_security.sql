-- Expect: only the verified Google hbplus.fit user sees (only their own) row; all writes and anon access denied.
\pset tuples_only on
\set ON_ERROR_STOP off
-- Fixtures (as superuser). Legacy/odd users bypass the trigger to simulate pre-existing data.
alter table auth.users disable trigger user;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','jane@hbplus.fit',now(),'{"provider":"google"}'),
 ('00000000-0000-0000-0000-00000000000b','unverified@hbplus.fit',null,'{"provider":"google"}'),
 ('00000000-0000-0000-0000-00000000000c','pw@hbplus.fit',now(),'{"provider":"email"}'),
 ('00000000-0000-0000-0000-00000000000d','legacy@gmail.com',now(),'{"provider":"google"}'),
 ('00000000-0000-0000-0000-00000000000e','x@hbplus.fit.attacker.com',now(),'{"provider":"google"}'),
 ('00000000-0000-0000-0000-00000000000f','sub@sub.hbplus.fit',now(),'{"provider":"google"}');
alter table auth.users enable trigger user;
insert into public.profiles(id,email) select id,email from auth.users where id::text like '00000000-%' on conflict do nothing;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;

select '--- RLS: rows visible when selecting ALL profiles, per signed-in user ---';
set role authenticated;
select 'jane (verified, google, hbplus.fit)  sees ' || count(*) || ' row(s)' from (select pg_temp.as_user('00000000-0000-0000-0000-00000000000a')) x, public.profiles;
select 'unverified hbplus.fit                sees ' || count(*) || ' row(s)' from (select pg_temp.as_user('00000000-0000-0000-0000-00000000000b')) x, public.profiles;
select 'email/password provider              sees ' || count(*) || ' row(s)' from (select pg_temp.as_user('00000000-0000-0000-0000-00000000000c')) x, public.profiles;
select 'legacy gmail account                 sees ' || count(*) || ' row(s)' from (select pg_temp.as_user('00000000-0000-0000-0000-00000000000d')) x, public.profiles;
select 'hbplus.fit.attacker.com account      sees ' || count(*) || ' row(s)' from (select pg_temp.as_user('00000000-0000-0000-0000-00000000000e')) x, public.profiles;
select 'sub.hbplus.fit account               sees ' || count(*) || ' row(s)' from (select pg_temp.as_user('00000000-0000-0000-0000-00000000000f')) x, public.profiles;
select 'no session (uid null)                sees ' || count(*) || ' row(s)' from (select pg_temp.as_user('')) x, public.profiles;

select '--- jane sees only HER OWN row ---';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select email from public.profiles;

select '--- writes by an authorized member ---';
do $$ begin
  begin update public.profiles set email='hacked@x.com'; raise notice 'UPDATE: allowed? rows=% ', (select count(*) from public.profiles where email='hacked@x.com');
  exception when others then raise notice 'UPDATE: DENIED (%)', sqlerrm; end;
  begin insert into public.profiles(id,email) values (gen_random_uuid(),'z@hbplus.fit'); raise notice 'INSERT: ALLOWED (BAD)';
  exception when others then raise notice 'INSERT: DENIED (%)', sqlerrm; end;
  begin delete from public.profiles; raise notice 'DELETE: rows deleted=% (0 expected)', (select 0);
  exception when others then raise notice 'DELETE: DENIED (%)', sqlerrm; end;
end $$;

select '--- anon role ---';
reset role; set role anon;
do $$ begin
  begin perform count(*) from public.profiles; raise notice 'anon SELECT: ALLOWED (BAD)';
  exception when others then raise notice 'anon SELECT: DENIED (%)', sqlerrm; end;
end $$;
reset role;
select '--- jane profile untouched ---';
select email from public.profiles where id='00000000-0000-0000-0000-00000000000a';
