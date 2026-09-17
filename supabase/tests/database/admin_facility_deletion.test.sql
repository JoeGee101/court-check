begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(23);

select ok(
  to_regprocedure('public.admin_delete_facility(uuid)') is not null,
  'admin facility deletion RPC exists'
);

select ok(
  (
    select functions.prosecdef
    from pg_proc as functions
    where functions.oid = 'public.admin_delete_facility(uuid)'::regprocedure
  ),
  'admin facility deletion RPC is SECURITY DEFINER'
);

select ok(
  (
    select
      pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
      and functions.proconfig @> array['search_path=""']::text[]
    from pg_proc as functions
    where functions.oid = 'public.admin_delete_facility(uuid)'::regprocedure
  ),
  'admin facility deletion RPC has a trusted owner and empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_delete_facility(uuid)',
    'execute'
  ),
  'authenticated clients may invoke the guarded deletion RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_delete_facility(uuid)',
    'execute'
  )
  and not exists (
    select 1
    from pg_proc as functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) as privileges
    where functions.oid = 'public.admin_delete_facility(uuid)'::regprocedure
      and privileges.grantee = 0
      and privileges.privilege_type = 'EXECUTE'
  ),
  'anonymous clients and PUBLIC cannot execute the deletion RPC'
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
    '22000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    '+15555550301',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    '+15555550302',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    '+15555550303',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

update public.user_roles
set role = 'admin'
where user_id = '22000000-0000-4000-8000-000000000002';

insert into public.facilities (
  id,
  name,
  address,
  location,
  hours_text,
  court_count,
  is_active
)
values
  (
    '22000000-0000-4000-8000-000000000010',
    'Unused Deletion Courts',
    '10 Deletion Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.20, 36.10), 4326)::extensions.geography,
    'Sunrise - Sunset',
    2,
    false
  ),
  (
    '22000000-0000-4000-8000-000000000011',
    'Completed History Courts',
    '11 Deletion Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.21, 36.11), 4326)::extensions.geography,
    'Sunrise - Sunset',
    2,
    false
  ),
  (
    '22000000-0000-4000-8000-000000000012',
    'Expired Open History Courts',
    '12 Deletion Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.22, 36.12), 4326)::extensions.geography,
    'Sunrise - Sunset',
    2,
    false
  ),
  (
    '22000000-0000-4000-8000-000000000013',
    'Status History Courts',
    '13 Deletion Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.23, 36.13), 4326)::extensions.geography,
    'Sunrise - Sunset',
    2,
    false
  ),
  (
    '22000000-0000-4000-8000-000000000014',
    'Unrelated Courts',
    '14 Deletion Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.24, 36.14), 4326)::extensions.geography,
    'Sunrise - Sunset',
    2,
    false
  );

insert into public.facility_geofences (facility_id, center, radius_m)
select
  facilities.id,
  facilities.location,
  100
from public.facilities as facilities
where facilities.id between
  '22000000-0000-4000-8000-000000000010'::uuid
  and '22000000-0000-4000-8000-000000000014'::uuid;

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
    '22000000-0000-4000-8000-000000000020',
    '22000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000011',
    statement_timestamp() - interval '3 hours',
    statement_timestamp() - interval '90 minutes',
    statement_timestamp() - interval '90 minutes',
    'expired'
  ),
  (
    '22000000-0000-4000-8000-000000000021',
    '22000000-0000-4000-8000-000000000003',
    '22000000-0000-4000-8000-000000000012',
    statement_timestamp() - interval '2 hours',
    statement_timestamp() - interval '30 minutes',
    null,
    null
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
values (
  '22000000-0000-4000-8000-000000000030',
  '22000000-0000-4000-8000-000000000013',
  '22000000-0000-4000-8000-000000000001',
  'courts_closed',
  statement_timestamp() - interval '6 hours',
  statement_timestamp() - interval '2 hours',
  statement_timestamp() - interval '2 hours',
  'expired'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '22000000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000010')$$,
  '42501',
  'Administrator role required',
  'a normal authenticated user cannot delete a facility'
);

set local request.jwt.claim.role = 'admin';

select throws_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000010')$$,
  '42501',
  'Administrator role required',
  'a claimed admin JWT role cannot spoof database role membership'
);

set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '22000000-0000-4000-8000-000000000002';

select throws_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000099')$$,
  'P0002',
  'Facility not found',
  'a missing facility uses the established not-found convention'
);

select lives_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000010')$$,
  'an admin can delete a facility with no activity history'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000010'),
  0::bigint,
  'permitted deletion removes the facility row'
);

select is(
  (select count(*) from public.facility_geofences where facility_id = '22000000-0000-4000-8000-000000000010'),
  0::bigint,
  'permitted deletion removes the facility geofence'
);

select is(
  (select count(*) from public.facility_activity where facility_id = '22000000-0000-4000-8000-000000000010'),
  0::bigint,
  'permitted deletion removes the derived activity projection'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000014'),
  1::bigint,
  'deleting one facility leaves an unrelated facility untouched'
);

select throws_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000011')$$,
  '23503',
  'Facility has activity history',
  'a completed check-in blocks permanent deletion'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000011'),
  1::bigint,
  'failed deletion leaves the check-in facility intact'
);

select is(
  (select count(*) from public.check_ins where facility_id = '22000000-0000-4000-8000-000000000011'),
  1::bigint,
  'failed deletion preserves completed check-in history'
);

select throws_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000012')$$,
  '23503',
  'Facility has activity history',
  'an expired but still-open check-in blocks permanent deletion'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000012'),
  1::bigint,
  'failed deletion leaves the expired-history facility intact'
);

select is(
  (select count(*) from public.check_ins where facility_id = '22000000-0000-4000-8000-000000000012'),
  1::bigint,
  'failed deletion preserves expired open check-in history'
);

select throws_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000013')$$,
  '23503',
  'Facility has activity history',
  'an expired and ended status report blocks permanent deletion'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000013'),
  1::bigint,
  'failed deletion leaves the status-history facility intact'
);

select is(
  (select count(*) from public.facility_statuses where facility_id = '22000000-0000-4000-8000-000000000013'),
  1::bigint,
  'failed deletion preserves status-report history'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000014'),
  1::bigint,
  'history rejection leaves unrelated facilities untouched'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select * from finish();
rollback;
