begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(24);

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

select ok(
  not (
    select columns.is_nullable = 'NO'
    from information_schema.columns as columns
    where columns.table_schema = 'public'
      and columns.table_name = 'check_ins'
      and columns.column_name = 'facility_id'
  )
  and not (
    select columns.is_nullable = 'NO'
    from information_schema.columns as columns
    where columns.table_schema = 'public'
      and columns.table_name = 'facility_statuses'
      and columns.column_name = 'facility_id'
  ),
  'historical facility references can be detached after facility deletion'
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
  ),
  (
    '22000000-0000-4000-8000-000000000022',
    '22000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000011',
    statement_timestamp() - interval '10 minutes',
    statement_timestamp() + interval '80 minutes',
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
), (
  '22000000-0000-4000-8000-000000000031',
  '22000000-0000-4000-8000-000000000013',
  '22000000-0000-4000-8000-000000000001',
  'maintenance',
  statement_timestamp(),
  statement_timestamp() + interval '8 hours',
  null,
  null
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

select lives_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000011')$$,
  'admin may delete a facility with completed check-in history'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000011'),
  0::bigint,
  'deletion removes the facility despite check-in history'
);

select ok(
  exists (
    select 1 from public.check_ins
    where id = '22000000-0000-4000-8000-000000000020'
      and facility_id is null
      and facility_name_snapshot = 'Completed History Courts'
      and checked_out_at = expires_at
      and checkout_reason = 'expired'
  )
  and exists (
    select 1 from public.check_ins
    where id = '22000000-0000-4000-8000-000000000022'
      and facility_id is null
      and facility_name_snapshot = 'Completed History Courts'
      and checked_out_at is not null
      and checkout_reason = 'facility_deactivated'
  ),
  'completed history survives and active check-ins close before facility detachment'
);

select lives_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000012')$$,
  'admin may delete a facility with an expired open check-in'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000012'),
  0::bigint,
  'expired-history facility is removed'
);

select ok(
  exists (
    select 1 from public.check_ins
    where id = '22000000-0000-4000-8000-000000000021'
      and facility_id is null
      and facility_name_snapshot = 'Expired Open History Courts'
      and checked_out_at = expires_at
      and checkout_reason = 'expired'
  ),
  'expired open check-in is finalized and retained without its facility link'
);

select lives_ok(
  $$select public.admin_delete_facility('22000000-0000-4000-8000-000000000013')$$,
  'admin may delete a facility with ended status history'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000013'),
  0::bigint,
  'status-history facility is removed'
);

select ok(
  exists (
    select 1 from public.facility_statuses
    where id = '22000000-0000-4000-8000-000000000030'
      and facility_id is null
      and facility_name_snapshot = 'Status History Courts'
  )
  and exists (
    select 1 from public.facility_statuses
    where id = '22000000-0000-4000-8000-000000000031'
      and facility_id is null
      and facility_name_snapshot = 'Status History Courts'
      and ended_at is not null
      and end_reason = 'facility_deactivated'
  ),
  'status history survives and active reports end before facility detachment'
);

select is(
  (select count(*) from public.facilities where id = '22000000-0000-4000-8000-000000000014'),
  1::bigint,
  'deleting facilities with history leaves unrelated facilities untouched'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select * from finish();
rollback;
