begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(21);

select ok(
  to_regprocedure('public.admin_get_facility(uuid)') is not null,
  'admin facility detail RPC exists'
);

select ok(
  (
    select functions.prosecdef
    from pg_proc as functions
    where functions.oid = 'public.admin_get_facility(uuid)'::regprocedure
  ),
  'admin facility detail RPC is SECURITY DEFINER'
);

select ok(
  (
    select
      pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
      and functions.proconfig @> array['search_path=""']::text[]
    from pg_proc as functions
    where functions.oid = 'public.admin_get_facility(uuid)'::regprocedure
  ),
  'admin facility detail RPC has a trusted owner and empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_facility(uuid)',
    'execute'
  ),
  'authenticated clients may invoke the admin facility detail RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_get_facility(uuid)',
    'execute'
  )
  and not exists (
    select 1
    from pg_proc as functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) as privileges
    where functions.oid = 'public.admin_get_facility(uuid)'::regprocedure
      and privileges.grantee = 0
      and privileges.privilege_type = 'EXECUTE'
  ),
  'anonymous clients and PUBLIC cannot execute the admin facility detail RPC'
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
    '21000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    '+15555550201',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    '+15555550202',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

update public.user_roles
set role = 'admin'
where user_id = '21000000-0000-4000-8000-000000000002';

insert into public.facilities (
  id,
  name,
  address,
  location,
  hours_text,
  court_count,
  has_lights,
  has_restrooms,
  has_water,
  is_active,
  verified_by
)
values
  (
    '21000000-0000-4000-8000-000000000010',
    'Admin Read Active Courts',
    '10 Admin Test Way',
    extensions.st_setsrid(
      extensions.st_makepoint(-115.210123, 36.110456),
      4326
    )::extensions.geography,
    '6:00 AM - 10:00 PM',
    6,
    true,
    true,
    false,
    true,
    'Test Parks Authority'
  ),
  (
    '21000000-0000-4000-8000-000000000011',
    'Admin Read Inactive Courts',
    '11 Admin Test Way',
    extensions.st_setsrid(
      extensions.st_makepoint(-115.220123, 36.120456),
      4326
    )::extensions.geography,
    'Sunrise - Sunset',
    2,
    false,
    false,
    true,
    false,
    null
  );

insert into public.facility_geofences (facility_id, center, radius_m)
values (
  '21000000-0000-4000-8000-000000000010',
  extensions.st_setsrid(
    extensions.st_makepoint(-115.210789, 36.110987),
    4326
  )::extensions.geography,
  175
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '21000000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.admin_get_facility('21000000-0000-4000-8000-000000000010')$$,
  '42501',
  'Administrator role required',
  'a normal authenticated user cannot read admin facility details'
);

set local request.jwt.claim.role = 'admin';

select throws_ok(
  $$select public.admin_get_facility('21000000-0000-4000-8000-000000000010')$$,
  '42501',
  'Administrator role required',
  'a claimed admin role cannot spoof database role membership'
);

set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '21000000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.admin_get_facility('21000000-0000-4000-8000-000000000010')$$,
  'a database-authorized admin can read an active facility'
);

select lives_ok(
  $$select public.admin_get_facility('21000000-0000-4000-8000-000000000011')$$,
  'a database-authorized admin can read an inactive facility'
);

select is(
  (
    select string_agg(keys.key, ',' order by keys.key)
    from jsonb_object_keys(
      public.admin_get_facility('21000000-0000-4000-8000-000000000010')
    ) as keys(key)
  ),
  'address,courtCount,createdAt,geofence,hasLights,hasRestrooms,hasWater,hoursText,id,isActive,latitude,longitude,name,updatedAt,verifiedBy',
  'admin facility detail exposes exactly the intended top-level fields'
);

select ok(
  not (
    public.admin_get_facility(
      '21000000-0000-4000-8000-000000000010'
    ) ?| array[
      'created_by',
      'updated_by',
      'createdBy',
      'updatedBy',
      'userId',
      'authorUserId'
    ]
  ),
  'admin facility detail exposes no audit or user identifiers'
);

select is(
  (
    public.admin_get_facility(
      '21000000-0000-4000-8000-000000000010'
    ) ->> 'latitude'
  )::double precision,
  36.110456::double precision,
  'public location Y is returned as latitude'
);

select is(
  (
    public.admin_get_facility(
      '21000000-0000-4000-8000-000000000010'
    ) ->> 'longitude'
  )::double precision,
  (-115.210123)::double precision,
  'public location X is returned as longitude'
);

select is(
  (
    public.admin_get_facility(
      '21000000-0000-4000-8000-000000000010'
    ) #>> '{geofence,latitude}'
  )::double precision,
  36.110987::double precision,
  'private geofence Y is returned as latitude'
);

select is(
  (
    public.admin_get_facility(
      '21000000-0000-4000-8000-000000000010'
    ) #>> '{geofence,longitude}'
  )::double precision,
  (-115.210789)::double precision,
  'private geofence X is returned as longitude'
);

select is(
  (
    public.admin_get_facility(
      '21000000-0000-4000-8000-000000000010'
    ) #>> '{geofence,radiusM}'
  )::integer,
  175,
  'private geofence radius is returned in meters'
);

select is(
  public.admin_get_facility(
    '21000000-0000-4000-8000-000000000011'
  ) -> 'geofence',
  'null'::jsonb,
  'a missing geofence is represented as JSON null'
);

select throws_ok(
  $$select public.admin_get_facility('21000000-0000-4000-8000-000000000099')$$,
  'P0002',
  'Facility not found',
  'admin facility detail uses the established not-found convention'
);

select ok(
  not exists (
    select 1
    from public.list_facilities() as facilities
    where to_jsonb(facilities) ?| array[
      'geofence',
      'geofenceLatitude',
      'geofenceLongitude',
      'geofenceRadiusM'
    ]
  ),
  'player facility list exposes no private geofence geometry'
);

select ok(
  not (
    public.get_facility_detail(
      '21000000-0000-4000-8000-000000000010'
    ) ?| array[
      'geofence',
      'geofenceLatitude',
      'geofenceLongitude',
      'geofenceRadiusM'
    ]
  ),
  'player facility detail exposes no private geofence geometry'
);

select is(
  (select count(*) from public.facility_geofences),
  1::bigint,
  'the admin read RPC does not mutate geofence data'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;

select * from finish();
rollback;
