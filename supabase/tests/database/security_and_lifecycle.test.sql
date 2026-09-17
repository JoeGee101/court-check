begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(93);

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

select is(
  (select facility_id from public.get_my_active_check_in()),
  '20000000-0000-4000-8000-000000000010'::uuid,
  'canonical active state returns the caller current facility'
);

select is(
  (select facility_name from public.get_my_active_check_in()),
  'Test Courts',
  'canonical active state returns safe facility display data'
);

select ok(
  (
    select
      checked_in_at < server_time
      and expires_at > server_time
    from public.get_my_active_check_in()
  ),
  'canonical active state uses database server time'
);

select ok(
  position(
    '20000000-0000-4000-8000-000000000001'
    in (select row_to_json(active_check_in)::text from public.get_my_active_check_in() as active_check_in)
  ) = 0,
  'canonical active state does not expose the caller user ID'
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

select is(
  (select count(*) from public.get_my_active_check_in()),
  0::bigint,
  'manually closed check-in is excluded from canonical active state'
);

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'a closed check-in cannot authorize a facility status'
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
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000010',
  now() - interval '2 hours',
  now() - interval '30 minutes'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.get_my_active_check_in()),
  0::bigint,
  'expired-but-still-open check-in is excluded using database time'
);

select is(
  (select checkout_reason::text from public.check_out()),
  'expired',
  'manual checkout records a due open row as expired'
);

select ok(
  (
    select checked_out_at = expires_at
    from public.check_ins
    where user_id = '20000000-0000-4000-8000-000000000001'
    order by checked_in_at desc
    limit 1
  ),
  'expired checkout closes the row at its server-authored expiry time'
);

set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000002';

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'a caller with no check-in cannot post a facility status'
);

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_full'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'courts-full reporting requires an active target-facility check-in'
);

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_wet_unsafe'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'wet-or-unsafe reporting requires an active target-facility check-in'
);

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'maintenance'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'maintenance reporting requires an active target-facility check-in'
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
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000010',
  now() - interval '2 hours',
  now() - interval '30 minutes'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'an expired but still-open check-in cannot authorize a facility status'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

update public.check_ins
set
  checked_out_at = expires_at,
  checkout_reason = 'expired'
where user_id = '20000000-0000-4000-8000-000000000001'
  and checked_out_at is null;

insert into public.check_ins (
  user_id,
  facility_id,
  checked_in_at,
  expires_at
)
values (
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000010',
  now(),
  now() + interval '90 minutes'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'another user check-in cannot authorize the caller'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

update public.check_ins
set
  checked_out_at = now(),
  checkout_reason = 'manual'
where user_id = '20000000-0000-4000-8000-000000000002'
  and checked_out_at is null;

insert into public.check_ins (
  user_id,
  facility_id,
  checked_in_at,
  expires_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000011',
  now(),
  now() + interval '90 minutes'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  '42501',
  'Active check-in at facility required',
  'a check-in at another facility cannot authorize a status'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

update public.check_ins
set
  checked_out_at = now(),
  checkout_reason = 'manual'
where user_id = '20000000-0000-4000-8000-000000000001'
  and checked_out_at is null;

insert into public.check_ins (
  user_id,
  facility_id,
  checked_in_at,
  expires_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000012',
  now(),
  now() + interval '90 minutes'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select throws_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000012',
      'courts_closed'
    )
  $$,
  'P0002',
  'Active facility not found',
  'an inactive facility rejects status posting'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

update public.check_ins
set
  checked_out_at = now(),
  checkout_reason = 'manual'
where user_id = '20000000-0000-4000-8000-000000000001'
  and checked_out_at is null;

insert into public.check_ins (
  user_id,
  facility_id,
  checked_in_at,
  expires_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000010',
  now(),
  now() + interval '90 minutes'
);

select set_config(
  'courtcheck.status_revision_before',
  (
    select revision::text
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  true
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  'an active target-facility check-in authorizes courts closed'
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

select ok(
  (
    select author_user_id = '20000000-0000-4000-8000-000000000001'::uuid
    from public.facility_statuses
    where status_type = 'courts_closed'
    order by created_at desc
    limit 1
  ),
  'facility status author is derived from auth.uid()'
);

select ok(
  (
    select revision > current_setting('courtcheck.status_revision_before')::bigint
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  'status posting increments the facility activity revision'
);

select set_config(
  'courtcheck.first_status_id',
  (
    select id::text
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and status_type = 'courts_closed'
  ),
  true
);
select set_config(
  'courtcheck.first_status_created_at',
  (
    select created_at::text
    from public.facility_statuses
    where id = current_setting('courtcheck.first_status_id')::uuid
  ),
  true
);
select set_config(
  'courtcheck.first_status_expires_at',
  (
    select expires_at::text
    from public.facility_statuses
    where id = current_setting('courtcheck.first_status_id')::uuid
  ),
  true
);
select set_config(
  'courtcheck.revision_after_first_status',
  (
    select revision::text
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  true
);

select is(
  (
    select id
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  ),
  current_setting('courtcheck.first_status_id')::uuid,
  'a repeated same-user active report returns the original status ID'
);

select ok(
  (
    select
      created_at = current_setting('courtcheck.first_status_created_at')::timestamptz
      and expires_at = current_setting('courtcheck.first_status_expires_at')::timestamptz
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  ),
  'an idempotent report preserves its creation and expiry timestamps'
);

select is(
  (
    select count(*)
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and facility_id = '20000000-0000-4000-8000-000000000010'
      and status_type = 'courts_closed'
      and ended_at is null
      and expires_at > now()
  ),
  1::bigint,
  'an idempotent report does not insert another active row'
);

select is(
  (
    select revision
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  current_setting('courtcheck.revision_after_first_status')::bigint,
  'an idempotent report does not increment the activity revision'
);

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'tournament_at_courts'
    )
  $$,
  'an active target-facility check-in authorizes a tournament status'
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

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_full'
    )
  $$,
  'an active target-facility check-in authorizes courts-full reporting'
);

select ok(
  (
    select expires_at = created_at + interval '1 hour'
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and status_type = 'courts_full'
  ),
  'courts full receives a one-hour server expiry'
);

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_wet_unsafe'
    )
  $$,
  'an active target-facility check-in authorizes wet-or-unsafe reporting'
);

select ok(
  (
    select expires_at = created_at + interval '2 hours'
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and status_type = 'courts_wet_unsafe'
  ),
  'courts wet or unsafe receives a two-hour server expiry'
);

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'maintenance'
    )
  $$,
  'an active target-facility check-in authorizes maintenance reporting'
);

select ok(
  (
    select expires_at = created_at + interval '8 hours'
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and status_type = 'maintenance'
  ),
  'maintenance receives an eight-hour server expiry'
);

select set_config(
  'courtcheck.revision_before_all_status_retries',
  (
    select revision::text
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  true
);

select ok(
  (
    select bool_and(
      retry.id = status.id
      and retry.created_at = status.created_at
      and retry.expires_at = status.expires_at
    )
    from (
      values
        ('courts_closed'::public.facility_status_type),
        ('maintenance'::public.facility_status_type),
        ('courts_wet_unsafe'::public.facility_status_type),
        ('tournament_at_courts'::public.facility_status_type),
        ('courts_full'::public.facility_status_type)
    ) as types(status_type)
    cross join lateral public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      types.status_type
    ) as retry
    join public.facility_statuses as status
      on status.id = retry.id
     and status.author_user_id = '20000000-0000-4000-8000-000000000001'
  ),
  'active retries for all five types return the existing rows and timestamps'
);

select is(
  (
    select count(*)
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and facility_id = '20000000-0000-4000-8000-000000000010'
      and ended_at is null
      and expires_at > now()
  ),
  5::bigint,
  'one user can independently maintain exactly one active report of each type'
);

select is(
  (
    select revision
    from public.facility_activity
    where facility_id = '20000000-0000-4000-8000-000000000010'
  ),
  current_setting('courtcheck.revision_before_all_status_retries')::bigint,
  'idempotent retries for all five types do not increment activity revision'
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

update public.facility_statuses
set
  created_at = now() - interval '5 hours',
  expires_at = now() - interval '1 hour'
where id = current_setting('courtcheck.first_status_id')::uuid;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select isnt(
  (
    select id
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  ),
  current_setting('courtcheck.first_status_id')::uuid,
  'a logically expired prior report permits a new report'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select set_config(
  'courtcheck.status_before_end',
  (
    select id::text
    from public.facility_statuses
    where author_user_id = '20000000-0000-4000-8000-000000000001'
      and facility_id = '20000000-0000-4000-8000-000000000010'
      and status_type = 'courts_closed'
      and ended_at is null
      and expires_at > now()
  ),
  true
);

update public.facility_statuses
set
  ended_at = statement_timestamp(),
  end_reason = 'facility_deactivated'
where id = current_setting('courtcheck.status_before_end')::uuid;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select isnt(
  (
    select id
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  ),
  current_setting('courtcheck.status_before_end')::uuid,
  'an ended prior report permits a new report'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

update public.check_ins
set
  checked_out_at = now(),
  checkout_reason = 'manual'
where user_id = '20000000-0000-4000-8000-000000000001'
  and checked_out_at is null;

insert into public.check_ins (
  user_id,
  facility_id,
  checked_in_at,
  expires_at
)
values (
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000010',
  now(),
  now() + interval '90 minutes'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000002';

select lives_ok(
  $$
    select *
    from public.post_facility_status(
      '20000000-0000-4000-8000-000000000010',
      'courts_closed'
    )
  $$,
  'a different checked-in player can independently report the same status'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

insert into public.facility_statuses (
  facility_id,
  author_user_id,
  status_type,
  created_at,
  expires_at
)
values
  (
    '20000000-0000-4000-8000-000000000010',
    '20000000-0000-4000-8000-000000000002',
    'courts_closed',
    now(),
    now() + interval '4 hours'
  ),
  (
    '20000000-0000-4000-8000-000000000010',
    '20000000-0000-4000-8000-000000000003',
    'courts_closed',
    now() - interval '5 hours',
    now() - interval '1 hour'
  );

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000002';

select ok(
  public.get_facility_detail('20000000-0000-4000-8000-000000000010')
    -> 'statuses' @> '[{"type":"courts_closed","reporterCount":2}]'::jsonb,
  'facility detail counts distinct active reporters despite duplicate rows'
);

select is(
  (
    select (status ->> 'reporterCount')::integer
    from jsonb_array_elements(
      public.get_facility_detail('20000000-0000-4000-8000-000000000010')
        -> 'statuses'
    ) as status
    where status ->> 'type' = 'courts_closed'
  ),
  2,
  'facility detail excludes an expired-but-not-ended reporter using database time'
);

select ok(
  public.get_facility_detail('20000000-0000-4000-8000-000000000010')
    -> 'statuses' @> '[{"type":"tournament_at_courts","reporterCount":1}]'::jsonb,
  'one user can independently report the tournament status type'
);

select ok(
  public.get_facility_detail('20000000-0000-4000-8000-000000000010')
    -> 'statuses' @> '[
      {"type":"maintenance","reporterCount":1},
      {"type":"courts_wet_unsafe","reporterCount":1},
      {"type":"courts_full","reporterCount":1}
    ]'::jsonb,
  'facility detail returns the other three independent status aggregates'
);

select is(
  jsonb_array_length(
    public.get_facility_detail('20000000-0000-4000-8000-000000000010')
      -> 'statuses'
  ),
  5,
  'all five aggregate status types coexist in facility detail'
);

select is(
  (
    select string_agg(status ->> 'type', ',' order by ordinal)
    from jsonb_array_elements(
      public.get_facility_detail('20000000-0000-4000-8000-000000000010')
        -> 'statuses'
    ) with ordinality as statuses(status, ordinal)
  ),
  'courts_closed,maintenance,courts_wet_unsafe,tournament_at_courts,courts_full',
  'facility detail orders all status aggregates by canonical priority'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_facility_detail('20000000-0000-4000-8000-000000000010')
        -> 'statuses'
    ) as status
    where status ?| array[
      'id',
      'statusId',
      'authorUserId',
      'authorUsername',
      'userId'
    ]
  ),
  'facility detail status aggregates expose no report or reporter identity'
);

select ok(
  not exists (
    select 1
    from jsonb_array_elements(
      public.get_facility_detail('20000000-0000-4000-8000-000000000010')
        -> 'statuses'
    ) as status
    where not status ?& array[
      'type',
      'reporterCount',
      'latestReportedAt',
      'expiresAt'
    ]
  ),
  'facility detail status aggregates contain the complete safe contract'
);

select is(
  (
    select activity_state
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  'courts_closed',
  'facility list preserves courts-closed priority when both statuses coexist'
);

select is(
  (
    select activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  2,
  'facility list returns the distinct reporter count for its selected status'
);

select is(
  (
    select activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000011'
  ),
  0,
  'facility list returns zero reporters for a non-status activity state'
);

reset role;

update public.facility_statuses
set
  ended_at = statement_timestamp(),
  end_reason = 'facility_deactivated'
where facility_id = '20000000-0000-4000-8000-000000000010'
  and status_type = 'courts_closed'
  and ended_at is null
  and expires_at > statement_timestamp();

set local role authenticated;

select is(
  (
    select activity_state || ':' || activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  'maintenance:1',
  'facility list selects maintenance after courts closed ends'
);

reset role;

update public.facility_statuses
set
  ended_at = statement_timestamp(),
  end_reason = 'facility_deactivated'
where facility_id = '20000000-0000-4000-8000-000000000010'
  and status_type = 'maintenance'
  and ended_at is null
  and expires_at > statement_timestamp();

set local role authenticated;

select is(
  (
    select activity_state || ':' || activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  'courts_wet_unsafe:1',
  'facility list selects wet-or-unsafe after maintenance ends'
);

reset role;

update public.facility_statuses
set
  ended_at = statement_timestamp(),
  end_reason = 'facility_deactivated'
where facility_id = '20000000-0000-4000-8000-000000000010'
  and status_type = 'courts_wet_unsafe'
  and ended_at is null
  and expires_at > statement_timestamp();

set local role authenticated;

select is(
  (
    select activity_state || ':' || activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  'tournament_at_courts:1',
  'facility list selects tournament after wet-or-unsafe ends'
);

reset role;

update public.facility_statuses
set
  ended_at = statement_timestamp(),
  end_reason = 'facility_deactivated'
where facility_id = '20000000-0000-4000-8000-000000000010'
  and status_type = 'tournament_at_courts'
  and ended_at is null
  and expires_at > statement_timestamp();

set local role authenticated;

select is(
  (
    select activity_state || ':' || activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  'courts_full:1',
  'facility list selects courts full after tournament ends'
);

reset role;

update public.facility_statuses
set
  ended_at = statement_timestamp(),
  end_reason = 'facility_deactivated'
where facility_id = '20000000-0000-4000-8000-000000000010'
  and status_type = 'courts_full'
  and ended_at is null
  and expires_at > statement_timestamp();

set local role authenticated;

select is(
  (
    select activity_state || ':' || activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  'active:0',
  'facility list falls back to active with zero reporters'
);

reset role;

update public.check_ins
set
  checked_out_at = statement_timestamp(),
  checkout_reason = 'manual'
where user_id = '20000000-0000-4000-8000-000000000002'
  and checked_out_at is null;

set local role authenticated;

select is(
  (
    select activity_state || ':' || activity_reporter_count
    from public.list_facilities()
    where id = '20000000-0000-4000-8000-000000000010'
  ),
  'quiet:0',
  'facility list falls back to quiet with zero reporters'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

update public.check_ins
set
  checked_out_at = now(),
  checkout_reason = 'manual'
where user_id in (
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002'
  )
  and checked_out_at is null;

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

set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.get_my_active_check_in()),
  0::bigint,
  'canonical active state cannot return another user check-in'
);

select throws_ok(
  $$select * from public.check_out()$$,
  'P0002',
  'No open check-in found',
  'checkout cannot target another user active check-in'
);

set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000002';

select is(
  (select facility_id from public.get_my_active_check_in()),
  '20000000-0000-4000-8000-000000000010'::uuid,
  'another user check-in remains active after the isolated checkout attempt'
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
