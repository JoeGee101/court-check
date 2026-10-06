begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(10);

select ok(
  to_regprocedure('public.get_my_play_time_summary()') is not null,
  'profile play-time summary RPC exists'
);

select ok(
  (
    select functions.prosecdef
      and functions.proconfig @> array['search_path=""']::text[]
      and pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
    from pg_proc as functions
    where functions.oid = 'public.get_my_play_time_summary()'::regprocedure
  ),
  'play-time summary RPC has a trusted owner and empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_play_time_summary()',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.get_my_play_time_summary()',
    'execute'
  )
  and not exists (
    select 1
    from pg_proc as functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) as privileges
    where functions.oid = 'public.get_my_play_time_summary()'::regprocedure
      and privileges.grantee = 0
      and privileges.privilege_type = 'EXECUTE'
  ),
  'authenticated-only execution is granted without anon or PUBLIC access'
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
  (
    '26000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    '+15555550601',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '26000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    '+15555550602',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.facilities (
  id,
  name,
  address,
  location,
  hours_text,
  court_count,
  is_active
)
values (
  '26000000-0000-4000-8000-000000000010',
  'Profile Play Time Courts',
  '10 Profile Test Way',
  extensions.st_setsrid(extensions.st_makepoint(-115.21, 36.11), 4326)::extensions.geography,
  '6:00 AM - 10:00 PM',
  4,
  true
);

insert into public.check_ins (
  id,
  user_id,
  facility_id,
  checked_in_at,
  expires_at,
  checked_out_at,
  checkout_reason
)
values
  (
    '26000000-0000-4000-8000-000000000101',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    now() - interval '2 days',
    now() - interval '2 days' + interval '90 minutes',
    now() - interval '2 days' + interval '30 minutes',
    'manual'
  ),
  (
    '26000000-0000-4000-8000-000000000102',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    now() - interval '5 days',
    now() - interval '5 days' + interval '90 minutes',
    now() - interval '5 days' + interval '45 minutes',
    'manual'
  ),
  (
    '26000000-0000-4000-8000-000000000103',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    now() - interval '8 days',
    now() - interval '8 days' + interval '90 minutes',
    now() - interval '8 days' + interval '60 minutes',
    'manual'
  ),
  (
    '26000000-0000-4000-8000-000000000104',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    now() - interval '10 days',
    now() - interval '10 days' + interval '90 minutes',
    now() - interval '10 days' + interval '20 minutes',
    'manual'
  ),
  (
    '26000000-0000-4000-8000-000000000105',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    statement_timestamp() - interval '20 minutes',
    statement_timestamp() - interval '20 minutes' + interval '90 minutes',
    null,
    null
  ),
  (
    '26000000-0000-4000-8000-000000000201',
    '26000000-0000-4000-8000-000000000002',
    '26000000-0000-4000-8000-000000000010',
    now() - interval '1 day',
    now() - interval '1 day' + interval '90 minutes',
    now() - interval '1 day' + interval '10 minutes',
    'manual'
  );

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
reset request.jwt.claim.sub;

select throws_ok(
  $$select public.get_my_play_time_summary()$$,
  '42501',
  'Active account required',
  'unauthenticated calls cannot read profile play-time data'
);

set local request.jwt.claim.sub = '26000000-0000-4000-8000-000000000001';

select is(
  (
    select (summary.value->>'weeklySeconds')::bigint
    from (
      select public.get_my_play_time_summary() as value
    ) as summary
    cross join public.check_ins as active_session
    where active_session.id = '26000000-0000-4000-8000-000000000105'
  ),
  (
    select 4500 + floor(extract(epoch from (
      statement_timestamp() - active_session.checked_in_at
    )))::bigint
    from public.check_ins as active_session
    where active_session.id = '26000000-0000-4000-8000-000000000105'
  ),
  'rolling seven-day total includes checkout durations and current elapsed play time'
);

select is(
  jsonb_array_length(
    public.get_my_play_time_summary()->'recentSessions'
  ),
  3,
  'profile summary returns only the three most recent sessions'
);

select is(
  (public.get_my_play_time_summary()->'recentSessions'->0->>'isActive')::boolean,
  true,
  'an unexpired open check-in is identified as in progress'
);

select ok(
  (public.get_my_play_time_summary()->'recentSessions'->0->>'checkedInAt')::timestamptz
    > (public.get_my_play_time_summary()->'recentSessions'->1->>'checkedInAt')::timestamptz,
  'recent sessions are returned newest first'
);

select ok(
  not (
    public.get_my_play_time_summary() ?| array['id', 'userId', 'user_id', 'phone', 'email']
  ),
  'summary exposes no account identifier or contact data'
);

set local request.jwt.claim.sub = '26000000-0000-4000-8000-000000000002';

select is(
  (public.get_my_play_time_summary()->>'weeklySeconds')::bigint,
  600::bigint,
  'each player receives only their own play-time total'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select * from finish();
rollback;
