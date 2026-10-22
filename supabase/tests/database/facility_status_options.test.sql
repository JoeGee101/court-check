begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(10);

insert into auth.users (id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('34000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '+15555550501', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

update public.profiles
set adult_confirmed_at = now(), experience_level = 'beginner', onboarding_completed_at = now()
where id = '34000000-0000-4000-8000-000000000001';

insert into public.facilities (id, name, address, location, hours_text, court_count, is_active)
values (
  '34000000-0000-4000-8000-000000000010',
  'Status Options Test Courts',
  '10 Status Test Way',
  extensions.st_setsrid(extensions.st_makepoint(-115.20, 36.10), 4326)::extensions.geography,
  '8:00 AM – 10:00 PM',
  2,
  false
);

insert into public.facility_geofences (facility_id, center, radius_m)
values (
  '34000000-0000-4000-8000-000000000010',
  extensions.st_setsrid(extensions.st_makepoint(-115.20, 36.10), 4326)::extensions.geography,
  100
);
update public.facilities set is_active = true where id = '34000000-0000-4000-8000-000000000010';

insert into public.check_ins (user_id, facility_id, checked_in_at, expires_at)
values (
  '34000000-0000-4000-8000-000000000001',
  '34000000-0000-4000-8000-000000000010',
  statement_timestamp() - interval '5 minutes',
  statement_timestamp() + interval '85 minutes'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '34000000-0000-4000-8000-000000000001';

select lives_ok($$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'league_in_progress')$$, 'league in progress can be reported');
select lives_ok($$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'need_players')$$, 'need players can be reported');
select lives_ok($$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'open_courts')$$, 'open courts can be reported');
select lives_ok($$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'short_wait')$$, 'short wait can be reported');
select lives_ok($$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'long_wait')$$, 'long wait can be reported');
select lives_ok($$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'lights_out_of_order')$$, 'lights out of order can be reported');

select is(
  (select count(*) from public.facility_statuses where facility_id = '34000000-0000-4000-8000-000000000010'),
  6::bigint,
  'all new status types are stored'
);
select ok(
  not exists (
    select 1 from public.facility_statuses
    where facility_id = '34000000-0000-4000-8000-000000000010'
      and expires_at <> created_at + case status_type
        when 'league_in_progress' then interval '8 hours'
        when 'need_players' then interval '1 hour'
        when 'open_courts' then interval '1 hour'
        when 'short_wait' then interval '10 minutes'
        when 'long_wait' then interval '30 minutes'
        when 'lights_out_of_order' then interval '8 hours'
      end
  ),
  'new statuses use fixed database-controlled expirations'
);
select throws_ok(
  $$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'courts_full')$$,
  '22023',
  'This status is no longer available',
  'new Courts Full reports are rejected'
);
select throws_ok(
  $$select public.post_facility_status('34000000-0000-4000-8000-000000000010', 'courts_wet_unsafe')$$,
  '22023',
  'This status is no longer available',
  'new Courts Wet / Unsafe reports are rejected'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;
select * from finish();
rollback;
