-- Expect: hbplus.fit variants ACCEPTED; everything else REJECTED with the required message.
\set ON_ERROR_STOP off
\pset tuples_only on
-- helper: try an insert and report ACCEPTED / REJECTED
create or replace function pg_temp.try_signup(p_email text, p_confirmed boolean default true, p_provider text default 'google')
returns text language plpgsql as $$
begin
  insert into auth.users(email, email_confirmed_at, raw_app_meta_data)
  values (p_email, case when p_confirmed then now() end, jsonb_build_object('provider', p_provider));
  return 'ACCEPTED';
exception when others then return 'REJECTED: ' || sqlerrm;
end $$;

select '--- SIGNUP TRIGGER ---';
select rpad(coalesce(e,'<NULL>'), 38) || pg_temp.try_signup(e)
from unnest(array[
  'user@hbplus.fit', 'USER2@HBPLUS.FIT', '  spaced@hbplus.fit  ',
  'user@gmail.com', 'user@not-hbplus.fit', 'user@hbplus.fit.attacker.com',
  'user@sub.hbplus.fit', 'a@evil.com@hbplus.fit', '@hbplus.fit', 'hbplus.fit',
  'user@hbplus.fit.', '', NULL
]::text[]) as e;

do $$ begin
  begin update auth.users set email='moved@gmail.com' where email='user@hbplus.fit'; raise notice 'UPDATE to gmail: ACCEPTED (BAD)';
  exception when others then raise notice 'UPDATE to gmail: REJECTED (%)', sqlerrm; end;
  begin update auth.users set email='new.name@hbplus.fit' where email='user@hbplus.fit'; raise notice 'UPDATE to same domain: ACCEPTED';
  exception when others then raise notice 'UPDATE to same domain: REJECTED (BAD)'; end;
end $$;

select '--- PROFILES CREATED ONLY FOR ACCEPTED USERS ---';
select email from public.profiles order by email;
