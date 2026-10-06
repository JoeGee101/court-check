begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select ok(
  to_regprocedure('public.get_facility_detail(uuid)') is not null,
  'facility detail RPC remains the canonical facility read'
);

select ok(
  (
    select functions.prosecdef
      and functions.proconfig @> array['search_path=""']::text[]
      and pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
    from pg_proc as functions
    where functions.oid = 'public.get_facility_detail(uuid)'::regprocedure
  ),
  'facility detail leaderboard is calculated in a trusted SECURITY DEFINER function'
);

select ok(
  has_function_privilege('authenticated', 'public.get_facility_detail(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_facility_detail(uuid)', 'execute'),
  'facility detail keeps authenticated-only execution'
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
  ('27000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '+15555550701', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('27000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '+15555550702', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('27000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', '+15555550703', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles
set experience_level = case id
  when '27000000-0000-4000-8000-000000000001' then 'advanced'::public.experience_level
  when '27000000-0000-4000-8000-000000000002' then 'beginner'::public.experience_level
  else 'intermediate'::public.experience_level
end
where id in (
  '27000000-0000-4000-8000-000000000001',
  '27000000-0000-4000-8000-000000000002',
  '27000000-0000-4000-8000-000000000003'
);

insert into public.facilities (
  id, name, address, location, hours_text, court_count, is_active
)
values
  (
    '27000000-0000-4000-8000-000000000010',
    'Monthly Leaderboard Courts',
    '10 Monthly Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.21, 36.11), 4326)::extensions.geography,
    '6:00 AM - 10:00 PM',
    4,
    true
  ),
  (
    '27000000-0000-4000-8000-000000000011',
    'Other Leaderboard Courts',
    '11 Monthly Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.22, 36.12), 4326)::extensions.geography,
    '6:00 AM - 10:00 PM',
    2,
    true
  );

insert into public.check_ins (
  id, user_id, facility_id, checked_in_at, expires_at, checked_out_at, checkout_reason
)
values
  (
    '27000000-0000-4000-8000-000000000101',
    '27000000-0000-4000-8000-000000000001',
    '27000000-0000-4000-8000-000000000010',
    statement_timestamp() - interval '2 hours',
    statement_timestamp() - interval '30 minutes',
    statement_timestamp() - interval '1 hour',
    'manual'
  ),
  (
    '27000000-0000-4000-8000-000000000102',
    '27000000-0000-4000-8000-000000000001',
    '27000000-0000-4000-8000-000000000010',
    (pg_catalog.date_trunc('month', statement_timestamp() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') - interval '30 minutes',
    (pg_catalog.date_trunc('month', statement_timestamp() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') + interval '60 minutes',
    (pg_catalog.date_trunc('month', statement_timestamp() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') + interval '30 minutes',
    'manual'
  ),
  (
    '27000000-0000-4000-8000-000000000103',
    '27000000-0000-4000-8000-000000000001',
    '27000000-0000-4000-8000-000000000011',
    statement_timestamp() - interval '3 hours',
    statement_timestamp() - interval '90 minutes',
    statement_timestamp() - interval '2 hours',
    'manual'
  ),
  (
    '27000000-0000-4000-8000-000000000201',
    '27000000-0000-4000-8000-000000000002',
    '27000000-0000-4000-8000-000000000010',
    statement_timestamp() - interval '85 minutes',
    statement_timestamp() + interval '5 minutes',
    statement_timestamp() - interval '5 minutes',
    'manual'
  ),
  (
    '27000000-0000-4000-8000-000000000202',
    '27000000-0000-4000-8000-000000000002',
    '27000000-0000-4000-8000-000000000010',
    (pg_catalog.date_trunc('month', statement_timestamp() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') - interval '3 hours',
    (pg_catalog.date_trunc('month', statement_timestamp() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') - interval '90 minutes',
    (pg_catalog.date_trunc('month', statement_timestamp() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles') - interval '150 minutes',
    'manual'
  ),
  (
    '27000000-0000-4000-8000-000000000301',
    '27000000-0000-4000-8000-000000000003',
    '27000000-0000-4000-8000-000000000010',
    statement_timestamp() - interval '20 minutes',
    statement_timestamp() + interval '70 minutes',
    null,
    null
  ),
  (
    '27000000-0000-4000-8000-000000000401',
    null,
    '27000000-0000-4000-8000-000000000010',
    statement_timestamp() - interval '3 hours',
    statement_timestamp() - interval '90 minutes',
    statement_timestamp() - interval '2 hours',
    'account_deleted'
  );

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '27000000-0000-4000-8000-000000000001';

select is(
  public.get_facility_detail('27000000-0000-4000-8000-000000000010')->>'leaderboardMonth',
  pg_catalog.to_char(statement_timestamp() at time zone 'America/Los_Angeles', 'YYYY-MM'),
  'leaderboard month follows the current Nevada calendar month'
);

select is(
  jsonb_array_length(public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'),
  3,
  'leaderboard contains only players with attributable play time at this facility'
);

select is(
  public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'->0->>'experienceLevel',
  'advanced',
  'the most-played player ranks first'
);

select is(
  (public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'->0->>'totalSeconds')::bigint,
  5400::bigint,
  'monthly totals accumulate sessions and clip a session crossing month start'
);

select is(
  public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'->1->>'experienceLevel',
  'beginner',
  'the next player is ranked by their facility-specific monthly total'
);

select is(
  (public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'->1->>'totalSeconds')::bigint,
  4800::bigint,
  'sessions at another facility and sessions wholly before this month are excluded'
);

select is(
  public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'->2->>'experienceLevel',
  'intermediate',
  'an active session contributes elapsed time and is included in the ranking'
);

select ok(
  (public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'->2->>'totalSeconds')::bigint > 0,
  'active play time is counted through the canonical database time'
);

select ok(
  not (
    public.get_facility_detail('27000000-0000-4000-8000-000000000010')->'monthlyLeaderboard'->0
      ?| array['id', 'userId', 'user_id', 'phone', 'email']
  ),
  'leaderboard entries do not expose account identifiers or contact details'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select * from finish();
rollback;
