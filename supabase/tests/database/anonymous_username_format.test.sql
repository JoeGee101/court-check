begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(8);

select ok(
  to_regprocedure('public.generate_anonymous_username()') is not null,
  'anonymous username generator exists'
);

select ok(
  not has_function_privilege('anon', 'public.generate_anonymous_username()', 'execute')
  and not has_function_privilege('authenticated', 'public.generate_anonymous_username()', 'execute'),
  'clients cannot invoke the anonymous username generator directly'
);

insert into auth.users (
  id,
  aud,
  role,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('28000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '+15555550801', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('28000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '+15555550802', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('28000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '+15555550803', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

select is(
  (
    select count(*)
    from public.profiles
    where id::text like '28000000-%'
      and char_length(anonymous_username) <= 15
  ),
  3::bigint,
  'newly generated usernames are at most 15 characters'
);

select is(
  (
    select count(*)
    from public.profiles
    where char_length(anonymous_username) > 15
  ),
  0::bigint,
  'the one-time backfill leaves no profile username longer than 15 characters'
);

select is(
  (
    select count(*)
    from public.profiles
    where id::text like '28000000-%'
      and anonymous_username ~ '^[A-Za-z]+[0-9]{4}$'
  ),
  3::bigint,
  'newly generated usernames use readable words with a four-digit suffix'
);

select is(
  (
    select count(distinct lower(anonymous_username))
    from public.profiles
    where id::text like '28000000-%'
  ),
  3::bigint,
  'newly generated usernames remain case-insensitively unique'
);

select throws_ok(
  $$
    update public.profiles
    set anonymous_username = 'ShortName0001'
    where id = '28000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'Anonymous username is immutable',
  'the shorter generated format does not change username immutability'
);

select ok(
  (
    select triggers.tgenabled = 'O'
    from pg_trigger as triggers
    where triggers.tgrelid = 'public.profiles'::regclass
      and triggers.tgname = 'profiles_keep_anonymous_username'
      and not triggers.tgisinternal
  ),
  'the username immutability trigger is re-enabled after the one-time backfill'
);

select * from finish();
rollback;
