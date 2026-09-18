begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(51);

select ok(
  'account_deleted' = any(enum_range(null::public.checkout_reason)::text[]),
  'checkout reasons include account_deleted'
);

select ok(
  'account_deleted' = any(enum_range(null::public.facility_status_end_reason)::text[]),
  'facility status end reasons include account_deleted'
);

select ok(
  not (
    select attributes.attnotnull
    from pg_attribute as attributes
    where attributes.attrelid = 'public.check_ins'::regclass
      and attributes.attname = 'user_id'
  ),
  'retained check-in history permits a null user association'
);

select ok(
  not (
    select attributes.attnotnull
    from pg_attribute as attributes
    where attributes.attrelid = 'public.facility_statuses'::regclass
      and attributes.attname = 'author_user_id'
  ),
  'retained status history permits a null author association'
);

select ok(
  (
    select constraints.confdeltype = 'c'
    from pg_constraint as constraints
    where constraints.conname = 'profiles_id_fkey'
      and constraints.conrelid = 'public.profiles'::regclass
  )
  and (
    select constraints.confdeltype = 'c'
    from pg_constraint as constraints
    where constraints.conname = 'user_roles_user_id_fkey'
      and constraints.conrelid = 'public.user_roles'::regclass
  )
  and (
    select constraints.confdeltype = 'n'
    from pg_constraint as constraints
    where constraints.conname = 'check_ins_user_id_fkey'
      and constraints.conrelid = 'public.check_ins'::regclass
  )
  and (
    select constraints.confdeltype = 'n'
    from pg_constraint as constraints
    where constraints.conname = 'facility_statuses_author_user_id_fkey'
      and constraints.conrelid = 'public.facility_statuses'::regclass
  ),
  'account and history foreign keys use the approved cascade/set-null behavior'
);

select ok(
  (
    select functions.prosecdef
      and functions.proconfig @> array['search_path=""']::text[]
      and pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
    from pg_proc as functions
    where functions.oid =
      'public.handle_profile_account_deletion()'::regprocedure
  ),
  'profile deletion lifecycle has a trusted owner, SECURITY DEFINER, and empty search path'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.handle_profile_account_deletion()',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.handle_profile_account_deletion()',
    'execute'
  )
  and not exists (
    select 1
    from pg_proc as functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) as privileges
    where functions.oid =
      'public.handle_profile_account_deletion()'::regprocedure
      and privileges.grantee = 0
      and privileges.privilege_type = 'EXECUTE'
  ),
  'profile deletion lifecycle cannot be called directly by clients or service API callers'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_has_account()',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.current_user_has_account()',
    'execute'
  ),
  'only authenticated clients may evaluate their own account-existence predicate'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.account_deletion_session_is_active(uuid,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.account_deletion_session_is_active(uuid,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.account_deletion_session_is_active(uuid,uuid)',
    'execute'
  ),
  'current-session verification is service-only'
);

select ok(
  (
    select functions.prosecdef
      and functions.proconfig @> array['search_path=""']::text[]
      and pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
    from pg_proc as functions
    where functions.oid = 'public.current_user_has_account()'::regprocedure
  )
  and (
    select functions.prosecdef
      and functions.proconfig @> array['search_path=""']::text[]
      and pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
    from pg_proc as functions
    where functions.oid =
      'public.account_deletion_session_is_active(uuid,uuid)'::regprocedure
  ),
  'account-existence and session helpers use trusted fixed-search-path definitions'
);

select ok(
  (
    select pg_get_expr(policies.polqual, policies.polrelid)
      like '%current_user_has_account%'
    from pg_policy as policies
    where policies.polname = 'facilities_select_active_or_admin'
      and policies.polrelid = 'public.facilities'::regclass
  )
  and (
    select pg_get_expr(policies.polqual, policies.polrelid)
      like '%current_user_has_account%'
    from pg_policy as policies
    where policies.polname = 'facility_activity_select_authenticated'
      and policies.polrelid = 'public.facility_activity'::regclass
  ),
  'shared facility and activity reads require a live CourtCheck account'
);

select ok(
  (
    select strpos(pg_get_functiondef(functions.oid), 'for key share of profiles') > 0
      and strpos(pg_get_functiondef(functions.oid), 'pg_advisory_xact_lock') > 0
      and strpos(pg_get_functiondef(functions.oid), 'for key share of profiles')
        < strpos(pg_get_functiondef(functions.oid), 'pg_advisory_xact_lock')
    from pg_proc as functions
    where functions.oid =
      'public.check_in(uuid,double precision,double precision)'::regprocedure
  )
  and (
    select strpos(pg_get_functiondef(functions.oid), 'for key share of profiles') > 0
      and strpos(pg_get_functiondef(functions.oid), 'pg_advisory_xact_lock') > 0
      and strpos(pg_get_functiondef(functions.oid), 'for key share of profiles')
        < strpos(pg_get_functiondef(functions.oid), 'pg_advisory_xact_lock')
    from pg_proc as functions
    where functions.oid = 'public.check_out()'::regprocedure
  )
  and (
    select strpos(pg_get_functiondef(functions.oid), 'for key share of profiles') > 0
      and strpos(pg_get_functiondef(functions.oid), 'pg_advisory_xact_lock') > 0
      and strpos(pg_get_functiondef(functions.oid), 'for update of check_ins') > 0
      and strpos(pg_get_functiondef(functions.oid), 'for key share of profiles')
        < strpos(pg_get_functiondef(functions.oid), 'pg_advisory_xact_lock')
      and strpos(pg_get_functiondef(functions.oid), 'pg_advisory_xact_lock')
        < strpos(pg_get_functiondef(functions.oid), 'for update of check_ins')
    from pg_proc as functions
    where functions.oid =
      'public.post_facility_status(uuid,public.facility_status_type)'::regprocedure
  ),
  'player mutations lock the live profile before the per-user advisory and dependent rows'
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
    '23000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    '+15555550401',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '23000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    '+15555550402',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '23000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    '+15555550403',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

update public.profiles
set
  experience_level = 'intermediate',
  adult_confirmed_at = now(),
  onboarding_completed_at = now()
where id::text like '23000000-%';

update public.user_roles
set role = 'admin'
where user_id = '23000000-0000-4000-8000-000000000001';

insert into public.facilities (
  id,
  name,
  address,
  location,
  hours_text,
  court_count,
  is_active,
  created_by,
  updated_by
)
values
  (
    '23000000-0000-4000-8000-000000000010',
    'Active Deletion Courts',
    '10 Account Test Way',
    extensions.st_setsrid(
      extensions.st_makepoint(-115.20, 36.10), 4326
    )::extensions.geography,
    'Sunrise - Sunset',
    4,
    true,
    '23000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000001'
  ),
  (
    '23000000-0000-4000-8000-000000000011',
    'Expired Deletion Courts',
    '11 Account Test Way',
    extensions.st_setsrid(
      extensions.st_makepoint(-115.21, 36.11), 4326
    )::extensions.geography,
    'Sunrise - Sunset',
    4,
    true,
    null,
    null
  ),
  (
    '23000000-0000-4000-8000-000000000012',
    'Unrelated Account Courts',
    '12 Account Test Way',
    extensions.st_setsrid(
      extensions.st_makepoint(-115.22, 36.12), 4326
    )::extensions.geography,
    'Sunrise - Sunset',
    4,
    true,
    '23000000-0000-4000-8000-000000000003',
    '23000000-0000-4000-8000-000000000003'
  );

insert into public.facility_geofences (
  facility_id,
  center,
  radius_m,
  updated_by
)
select
  facilities.id,
  facilities.location,
  100,
  case
    when facilities.id = '23000000-0000-4000-8000-000000000010'
      then '23000000-0000-4000-8000-000000000001'::uuid
    else '23000000-0000-4000-8000-000000000003'::uuid
  end
from public.facilities as facilities
where facilities.id::text like '23000000-%';

select throws_ok(
  $$
    insert into public.check_ins (
      id,
      user_id,
      facility_id,
      checked_in_at,
      expires_at
    )
    values (
      '23000000-0000-4000-8000-000000000040',
      null,
      '23000000-0000-4000-8000-000000000010',
      statement_timestamp(),
      statement_timestamp() + interval '90 minutes'
    )
  $$,
  '23514',
  'new row for relation "check_ins" violates check constraint "check_ins_actor_required_while_open"',
  'an open check-in cannot have a null actor'
);

select throws_ok(
  $$
    insert into public.facility_statuses (
      id,
      facility_id,
      author_user_id,
      status_type,
      created_at,
      expires_at
    )
    values (
      '23000000-0000-4000-8000-000000000041',
      '23000000-0000-4000-8000-000000000010',
      null,
      'courts_closed',
      statement_timestamp(),
      statement_timestamp() + interval '4 hours'
    )
  $$,
  '23514',
  'new row for relation "facility_statuses" violates check constraint "facility_statuses_author_required_while_unended"',
  'an unended facility status cannot have a null author'
);

select lives_ok(
  $$
    insert into public.check_ins (
      id,
      user_id,
      facility_id,
      checked_in_at,
      expires_at,
      checked_out_at,
      checkout_reason
    )
    values (
      '23000000-0000-4000-8000-000000000042',
      null,
      '23000000-0000-4000-8000-000000000010',
      statement_timestamp() - interval '2 hours',
      statement_timestamp() - interval '30 minutes',
      statement_timestamp() - interval '30 minutes',
      'expired'
    )
  $$,
  'closed check-in history may retain a null actor'
);

select lives_ok(
  $$
    insert into public.facility_statuses (
      id,
      facility_id,
      author_user_id,
      status_type,
      created_at,
      expires_at,
      ended_at,
      end_reason
    )
    values (
      '23000000-0000-4000-8000-000000000043',
      '23000000-0000-4000-8000-000000000010',
      null,
      'courts_closed',
      statement_timestamp() - interval '5 hours',
      statement_timestamp() - interval '1 hour',
      statement_timestamp() - interval '1 hour',
      'expired'
    )
  $$,
  'ended facility-status history may retain a null author'
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
    '23000000-0000-4000-8000-000000000020',
    '23000000-0000-4000-8000-000000000001',
    '23000000-0000-4000-8000-000000000010',
    statement_timestamp() - interval '30 minutes',
    statement_timestamp() + interval '60 minutes',
    null,
    null
  ),
  (
    '23000000-0000-4000-8000-000000000021',
    '23000000-0000-4000-8000-000000000002',
    '23000000-0000-4000-8000-000000000011',
    statement_timestamp() - interval '2 hours',
    statement_timestamp() - interval '30 minutes',
    null,
    null
  ),
  (
    '23000000-0000-4000-8000-000000000022',
    '23000000-0000-4000-8000-000000000003',
    '23000000-0000-4000-8000-000000000012',
    statement_timestamp() - interval '3 hours',
    statement_timestamp() - interval '90 minutes',
    statement_timestamp() - interval '90 minutes',
    'expired'
  );

insert into public.facility_statuses (
  id,
  facility_id,
  author_user_id,
  status_type,
  created_at,
  expires_at,
  ended_at,
  end_reason
)
values
  (
    '23000000-0000-4000-8000-000000000030',
    '23000000-0000-4000-8000-000000000010',
    '23000000-0000-4000-8000-000000000001',
    'courts_closed',
    statement_timestamp() - interval '1 hour',
    statement_timestamp() + interval '3 hours',
    null,
    null
  ),
  (
    '23000000-0000-4000-8000-000000000031',
    '23000000-0000-4000-8000-000000000011',
    '23000000-0000-4000-8000-000000000002',
    'tournament_at_courts',
    statement_timestamp() - interval '9 hours',
    statement_timestamp() - interval '1 hour',
    null,
    null
  ),
  (
    '23000000-0000-4000-8000-000000000032',
    '23000000-0000-4000-8000-000000000012',
    '23000000-0000-4000-8000-000000000003',
    'courts_full',
    statement_timestamp() - interval '2 hours',
    statement_timestamp() - interval '1 hour',
    statement_timestamp() - interval '1 hour',
    'expired'
  );

insert into public.sms_otp_consent_events (
  phone_e164,
  request_key
)
values (
  '+15555550401',
  'accountdeletiontest000001'
);

select is(
  (
    select active_check_in_count
    from public.facility_activity
    where facility_id = '23000000-0000-4000-8000-000000000010'
  ),
  1,
  'active projection includes the account before deletion'
);

delete from auth.users
where id = '23000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from auth.users where id = '23000000-0000-4000-8000-000000000001'),
  0::bigint,
  'Auth user hard deletion completes'
);

select is(
  (select count(*) from public.profiles where id = '23000000-0000-4000-8000-000000000001'),
  0::bigint,
  'profile cascades from Auth deletion'
);

select is(
  (select count(*) from public.user_roles where user_id = '23000000-0000-4000-8000-000000000001'),
  0::bigint,
  'database role cascades from Auth deletion'
);

select is(
  (
    select checkout_reason
    from public.check_ins
    where id = '23000000-0000-4000-8000-000000000020'
  ),
  'account_deleted'::public.checkout_reason,
  'a current check-in closes as account_deleted'
);

select ok(
  (
    select checked_out_at between
      statement_timestamp() - interval '10 seconds'
      and statement_timestamp()
    from public.check_ins
    where id = '23000000-0000-4000-8000-000000000020'
  ),
  'a current check-in closes using database time'
);

select is(
  (
    select user_id
    from public.check_ins
    where id = '23000000-0000-4000-8000-000000000020'
  ),
  null,
  'current check-in history survives without a user association'
);

select is(
  (
    select end_reason
    from public.facility_statuses
    where id = '23000000-0000-4000-8000-000000000030'
  ),
  'account_deleted'::public.facility_status_end_reason,
  'a current facility status ends as account_deleted'
);

select is(
  (
    select author_user_id
    from public.facility_statuses
    where id = '23000000-0000-4000-8000-000000000030'
  ),
  null,
  'current status history survives without an author association'
);

select is(
  (
    select active_check_in_count
    from public.facility_activity
    where facility_id = '23000000-0000-4000-8000-000000000010'
  ),
  0,
  'account deletion refreshes the canonical facility count'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '23000000-0000-4000-8000-000000000003';

select is(
  (public.get_facility_detail('23000000-0000-4000-8000-000000000010')->>'activeCheckInCount')::integer,
  0,
  'canonical detail excludes the deleted account check-in'
);

select is(
  jsonb_array_length(
    public.get_facility_detail('23000000-0000-4000-8000-000000000010')->'statuses'
  ),
  0,
  'canonical detail excludes the deleted account status'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select is(
  (select count(*) from public.facilities where id = '23000000-0000-4000-8000-000000000010'),
  1::bigint,
  'deleting an admin account does not delete its facility'
);

select ok(
  (
    select created_by is null and updated_by is null
    from public.facilities
    where id = '23000000-0000-4000-8000-000000000010'
  )
  and (
    select updated_by is null
    from public.facility_geofences
    where facility_id = '23000000-0000-4000-8000-000000000010'
  ),
  'facility and geofence admin attribution becomes null'
);

select is(
  (
    select count(*)
    from public.sms_otp_consent_events
    where phone_e164 = '+15555550401'
  ),
  1::bigint,
  'SMS consent evidence remains independent of account deletion'
);

delete from auth.users
where id = '23000000-0000-4000-8000-000000000002';

select is(
  (
    select checkout_reason
    from public.check_ins
    where id = '23000000-0000-4000-8000-000000000021'
  ),
  'expired'::public.checkout_reason,
  'a logically expired open check-in closes as expired'
);

select ok(
  (
    select checked_out_at = expires_at
    from public.check_ins
    where id = '23000000-0000-4000-8000-000000000021'
  ),
  'a logically expired check-in closes at its canonical expiry'
);

select is(
  (
    select user_id
    from public.check_ins
    where id = '23000000-0000-4000-8000-000000000021'
  ),
  null,
  'expired check-in history is de-identified'
);

select is(
  (
    select end_reason
    from public.facility_statuses
    where id = '23000000-0000-4000-8000-000000000031'
  ),
  'expired'::public.facility_status_end_reason,
  'a logically expired unended status ends as expired'
);

select ok(
  (
    select ended_at = expires_at
    from public.facility_statuses
    where id = '23000000-0000-4000-8000-000000000031'
  ),
  'a logically expired status ends at its canonical expiry'
);

select is(
  (
    select author_user_id
    from public.facility_statuses
    where id = '23000000-0000-4000-8000-000000000031'
  ),
  null,
  'expired status history is de-identified'
);

select is(
  (select count(*) from auth.users where id = '23000000-0000-4000-8000-000000000003'),
  1::bigint,
  'an unrelated Auth user remains intact'
);

select is(
  (
    select user_id
    from public.check_ins
    where id = '23000000-0000-4000-8000-000000000022'
  ),
  '23000000-0000-4000-8000-000000000003'::uuid,
  'unrelated check-in history retains its owner'
);

select is(
  (
    select author_user_id
    from public.facility_statuses
    where id = '23000000-0000-4000-8000-000000000032'
  ),
  '23000000-0000-4000-8000-000000000003'::uuid,
  'unrelated status history retains its author'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '23000000-0000-4000-8000-000000000001';

select is(
  public.current_user_has_account(),
  false,
  'a deleted identity fails the live-account predicate'
);

select is(
  (select count(*) from public.facilities),
  0::bigint,
  'an accountless JWT cannot directly read facilities'
);

select is(
  (select count(*) from public.facility_activity),
  0::bigint,
  'an accountless JWT cannot read the Realtime activity projection'
);

select throws_ok(
  $$select * from public.list_facilities()$$,
  '42501',
  'Active account required',
  'an accountless JWT cannot use the canonical facility list RPC'
);

select throws_ok(
  $$select public.get_facility_detail('23000000-0000-4000-8000-000000000010')$$,
  '42501',
  'Active account required',
  'an accountless JWT cannot use the canonical facility detail RPC'
);

select is(
  public.current_user_is_admin(),
  false,
  'a deleted admin JWT no longer has database admin authority'
);

select throws_ok(
  $$
    select *
    from public.check_in(
      '23000000-0000-4000-8000-000000000010',
      36.10,
      -115.20
    )
  $$,
  '42501',
  'Completed phone-verified account required',
  'an accountless JWT cannot create a check-in'
);

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '23000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  '42501',
  'Completed account required',
  'an accountless JWT cannot post a facility status'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '23000000-0000-4000-8000-000000000003';

select is(
  (select count(*) from public.list_facilities()),
  3::bigint,
  'an unrelated live account retains canonical facility access'
);

select is(
  (
    select count(*)
    from public.check_in(
      '23000000-0000-4000-8000-000000000012',
      36.12,
      -115.22
    )
  ),
  1::bigint,
  'live-account check-in still succeeds after lock-order hardening'
);

select is(
  (
    select count(*)
    from public.post_facility_status(
      '23000000-0000-4000-8000-000000000012',
      'maintenance'
    )
  ),
  1::bigint,
  'live-account status reporting still succeeds after lock-order hardening'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select * from finish();
rollback;
