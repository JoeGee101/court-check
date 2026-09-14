begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(38);

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
    '20000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    '+15555550101',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    '+15555550102',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    '+15555550103',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select is(
  (select count(*) from public.profiles where id::text like '20000000-%'),
  3::bigint,
  'auth trigger creates a profile for each user'
);

select is(
  (
    select count(distinct lower(anonymous_username))
    from public.profiles
    where id::text like '20000000-%'
  ),
  3::bigint,
  'generated anonymous usernames are unique'
);

select is(
  (
    select count(*)
    from public.user_roles
    where user_id::text like '20000000-%'
      and role = 'user'
  ),
  3::bigint,
  'auth trigger assigns the user role by default'
);

select throws_ok(
  $$
    update public.profiles
    set anonymous_username = 'ChangedUsername'
    where id = '20000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'Anonymous username is immutable',
  'generated anonymous usernames cannot be changed'
);

update public.profiles
set
  experience_level = 'intermediate',
  adult_confirmed_at = now(),
  onboarding_completed_at = now()
where id::text like '20000000-%';

update public.user_roles
set role = 'admin'
where user_id = '20000000-0000-4000-8000-000000000003';

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
  '20000000-0000-4000-8000-000000000010',
  'Test Courts',
  '100 Test Way',
  extensions.st_setsrid(extensions.st_makepoint(-115.200000, 36.100000), 4326)::extensions.geography,
  'Sunrise - Sunset',
  4,
  true
);

insert into public.facility_geofences (facility_id, center, radius_m)
values (
  '20000000-0000-4000-8000-000000000010',
  extensions.st_setsrid(extensions.st_makepoint(-115.200000, 36.100000), 4326)::extensions.geography,
  150
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
values
  (
    '20000000-0000-4000-8000-000000000011',
    'Missing Geofence Courts',
    '110 Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.201000, 36.101000), 4326)::extensions.geography,
    'Sunrise - Sunset',
    2,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000012',
    'Inactive Courts',
    '120 Test Way',
    extensions.st_setsrid(extensions.st_makepoint(-115.202000, 36.102000), 4326)::extensions.geography,
    'Sunrise - Sunset',
    2,
    false
  );

insert into public.facility_geofences (facility_id, center, radius_m)
values (
  '20000000-0000-4000-8000-000000000012',
  extensions.st_setsrid(extensions.st_makepoint(-115.202000, 36.102000), 4326)::extensions.geography,
  150
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a normal user can read only their own profile'
);

select is(
  (select count(*) from public.user_roles),
  0::bigint,
  'a normal user cannot read raw roles'
);

select throws_ok(
  $$
    insert into public.facilities (
      name, address, location, hours_text, court_count
    ) values (
      'Forbidden Courts',
      '200 Test Way',
      extensions.st_setsrid(extensions.st_makepoint(-115.2, 36.1), 4326)::extensions.geography,
      'Always',
      1
    )
  $$,
  '42501',
  'permission denied for table facilities',
  'a normal user cannot insert a facility directly'
);

select throws_ok(
  $$
    update public.user_roles
    set role = 'admin'
    where user_id = '20000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table user_roles',
  'a normal user cannot promote themselves'
);

select throws_ok(
  $$
    select public.admin_set_facility_active(
      '20000000-0000-4000-8000-000000000010',
      false
    )
  $$,
  '42501',
  'Administrator role required',
  'a normal user cannot execute an admin operation successfully'
);

select throws_ok(
  $$
    select *
    from public.check_in(
      '20000000-0000-4000-8000-000000000011',
      36.101000,
      -115.201000
    )
  $$,
  'P0002',
  'Active facility with geofence not found',
  'check-in rejects a facility with no geofence'
);

select throws_ok(
  $$
    select *
    from public.check_in(
      '20000000-0000-4000-8000-000000000012',
      36.102000,
      -115.202000
    )
  $$,
  'P0002',
  'Active facility with geofence not found',
  'check-in rejects an inactive facility'
);

select throws_ok(
  $$
    select *
    from public.check_in(
      '20000000-0000-4000-8000-000000000010',
      36.200000,
      -115.300000
    )
  $$,
  '42501',
  'Outside facility geofence',
  'server-side PostGIS rejects an outside check-in'
);

select lives_ok(
  $$
    select *
    from public.check_in(
      '20000000-0000-4000-8000-000000000010',
      36.100000,
      -115.200000
    )
  $$,
  'server-side PostGIS accepts an inside check-in'
);

select ok(
  (
    select expires_at = checked_in_at + interval '90 minutes'
    from public.check_ins
    where user_id = '20000000-0000-4000-8000-000000000001'
      and checked_out_at is null
      and expires_at > now()
  ),
  'check-in expiry is exactly 90 minutes from database check-in time'
);

select throws_ok(
  $$
    select *
    from public.check_in(
      '20000000-0000-4000-8000-000000000010',
      36.100000,
      -115.200000
    )
  $$,
  '23505',
  'User already has an open check-in',
  'a user cannot create a second open check-in'
);

select ok(
  (
    select position(
      '20000000-0000-4000-8000-000000000001'
      in public.get_facility_detail(
        '20000000-0000-4000-8000-000000000010'
      )::text
    ) = 0
  ),
  'facility detail does not expose a player user ID'
);

select lives_ok(
  $$select * from public.check_out()$$,
  'manual checkout succeeds for the caller'
);

select ok(
  (
    select checked_out_at is not null and checkout_reason = 'manual'
    from public.check_ins
    where user_id = '20000000-0000-4000-8000-000000000001'
  ),
  'manual checkout closes and preserves the history row'
);

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  'an onboarded user can post courts closed'
);

select ok(
  (
    select expires_at = created_at + interval '4 hours'
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and status_type = 'courts_closed'
  ),
  'courts closed receives a four-hour server expiry'
);

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'tournament_at_courts'
    )
  $$,
  'an onboarded user can post a tournament status'
);

select ok(
  (
    select expires_at = created_at + interval '8 hours'
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and status_type = 'tournament_at_courts'
  ),
  'tournament status receives an eight-hour server expiry'
);

select ok(
  position(
    '20000000-0000-4000-8000-000000000001'
    in public.get_facility_detail(
      '20000000-0000-4000-8000-000000000010'
    )::text
  ) = 0,
  'facility status detail does not expose the author user ID'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

insert into public.check_ins (
  user_id,
  facility_id,
  checked_in_at,
  expires_at
)
values (
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000010',
  now() - interval '2 hours',
  now() - interval '30 minutes'
);

select is(
  (
    select active_check_in_count
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  0,
  'activity projection excludes an expired but still-open row'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000002';

select lives_ok(
  $$
    select *
    from public.check_in(
      '20000000-0000-4000-8000-000000000010',
      36.100000,
      -115.200000
    )
  $$,
  'check-in succeeds after logical expiry even before Cron cleanup'
);

select ok(
  (
    select count(*) = 2
      and count(*) filter (
        where checked_out_at is null and expires_at > now()
      ) = 1
      and count(*) filter (
        where checkout_reason = 'expired'
      ) = 1
    from public.check_ins
    where user_id = '20000000-0000-4000-8000-000000000002'
  ),
  'opportunistic expiry preserves history and leaves one active row'
);

select is(
  (
    select active_check_in_count
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  1,
  'activity projection counts only the current unexpired row'
);

set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select throws_ok(
  $$
    select public.admin_save_facility(
      null,
      'Too-small Geofence Courts',
      '290 Test Way',
      36.109000,
      -115.209000,
      '6:00 AM - 10:00 PM',
      2,
      true,
      true,
      true,
      false,
      'Test Parks Authority',
      36.109000,
      -115.209000,
      9
    )
  $$,
  '22023',
  'Geofence radius must be between 10 and 1000 meters',
  'admin facility save rejects a geofence radius below 10 meters'
);

select lives_ok(
  $$
    select public.admin_save_facility(
      null,
      'Admin-created Courts',
      '300 Test Way',
      36.110000,
      -115.210000,
      '6:00 AM - 10:00 PM',
      6,
      true,
      true,
      true,
      true,
      'Test Parks Authority',
      36.110000,
      -115.210000,
      10
    )
  $$,
  'an admin can create a facility and geofence atomically'
);

select is(
  (
    select count(*)
    from public.facility_geofences as geofences
    join public.facilities as facilities on facilities.id = geofences.facility_id
    where facilities.name = 'Admin-created Courts'
      and geofences.radius_m = 10
  ),
  1::bigint,
  'admin facility save stores the geofence'
);

select lives_ok(
  $$select public.admin_set_facility_active('20000000-0000-4000-8000-000000000010', false)$$,
  'an admin can deactivate a facility'
);

select is(
  (
    select is_active
    from public.facilities
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  false,
  'facility deactivation marks the facility inactive'
);

select is(
  (
    select checkout_reason::text
    from public.check_ins
    where user_id = '20000000-0000-4000-8000-000000000002'
      and facility_id = '20000000-0000-4000-8000-000000000010'
    order by checked_in_at desc
    limit 1
  ),
  'facility_deactivated',
  'facility deactivation closes an open check-in with the correct reason'
);

select is(
  (
    select count(*)
    from public.facility_statuses
    where facility_id = '20000000-0000-4000-8000-000000000010'
      and ended_at is null
  ),
  0::bigint,
  'facility deactivation ends active statuses'
);

select is(
  (
    select active_check_in_count
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  0,
  'facility deactivation refreshes the safe activity projection'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

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
  '20000000-0000-4000-8000-000000000020',
  'No Geofence Courts',
  '400 Test Way',
  extensions.st_setsrid(extensions.st_makepoint(-115.220000, 36.120000), 4326)::extensions.geography,
  'Sunrise - Sunset',
  2,
  false
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select throws_ok(
  $$
    select public.admin_set_facility_active(
      '20000000-0000-4000-8000-000000000020',
      true
    )
  $$,
  '23514',
  'A geofence is required before activation',
  'admin activation requires a geofence'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

insert into public.check_ins (
  user_id,
  facility_id,
  checked_in_at,
  expires_at
)
values (
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000010',
  now() - interval '2 hours',
  now() - interval '30 minutes'
);

select lives_ok(
  $$select * from public.expire_due_records()$$,
  'expiry maintenance closes due rows'
);

select ok(
  (
    select checked_out_at = expires_at and checkout_reason = 'expired'
    from public.check_ins
    where user_id = '20000000-0000-4000-8000-000000000003'
  ),
  'expiry maintenance preserves a row and records its exact expiry reason/time'
);

select * from finish();
rollback;
