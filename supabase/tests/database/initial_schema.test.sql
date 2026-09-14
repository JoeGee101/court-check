begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(41);

select ok(
  exists (select 1 from pg_extension where extname = 'postgis'),
  'PostGIS is enabled'
);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'user_roles', 'user_roles exists');
select has_table('public', 'facilities', 'facilities exists');
select has_table('public', 'facility_geofences', 'facility_geofences exists');
select has_table('public', 'check_ins', 'check_ins exists');
select has_table('public', 'facility_statuses', 'facility_statuses exists');
select has_table('public', 'facility_activity', 'facility_activity exists');

select ok(
  (
    select format_type(attributes.atttypid, attributes.atttypmod)
    from pg_attribute as attributes
    join pg_class as relations on relations.oid = attributes.attrelid
    join pg_namespace as schemas on schemas.oid = relations.relnamespace
    where schemas.nspname = 'public'
      and relations.relname = 'facilities'
      and attributes.attname = 'location'
  ) like '%geography(Point,4326)',
  'facility marker uses WGS84 geography point'
);

select ok(
  (
    select format_type(attributes.atttypid, attributes.atttypmod)
    from pg_attribute as attributes
    join pg_class as relations on relations.oid = attributes.attrelid
    join pg_namespace as schemas on schemas.oid = relations.relnamespace
    where schemas.nspname = 'public'
      and relations.relname = 'facility_geofences'
      and attributes.attname = 'center'
  ) like '%geography(Point,4326)',
  'geofence center uses WGS84 geography point'
);

select has_index(
  'public',
  'check_ins',
  'check_ins_one_open_per_user',
  'one-open-check-in index exists'
);
select ok(
  (
    select pg_get_expr(indexes.indpred, indexes.indrelid) like '%checked_out_at IS NULL%'
    from pg_index as indexes
    join pg_class as relations on relations.oid = indexes.indexrelid
    join pg_namespace as schemas on schemas.oid = relations.relnamespace
    where schemas.nspname = 'public'
      and relations.relname = 'check_ins_one_open_per_user'
  ),
  'one-open-check-in index is partial on checked_out_at IS NULL'
);
select has_index(
  'public',
  'facilities',
  'facilities_location_gist',
  'facility spatial index exists'
);
select has_index(
  'public',
  'facility_geofences',
  'facility_geofences_center_gist',
  'geofence spatial index exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass),
  'user_roles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.facilities'::regclass),
  'facilities has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.facility_geofences'::regclass),
  'facility_geofences has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.check_ins'::regclass),
  'check_ins has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.facility_statuses'::regclass),
  'facility_statuses has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.facility_activity'::regclass),
  'facility_activity has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select')
  and not has_table_privilege('anon', 'public.facilities', 'select')
  and not has_table_privilege('anon', 'public.facility_activity', 'select'),
  'anonymous clients have no application-table reads'
);

select ok(
  not has_table_privilege('authenticated', 'public.facilities', 'insert,update,delete'),
  'authenticated clients cannot mutate facilities directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.facility_geofences', 'insert,update,delete'),
  'authenticated clients cannot mutate geofences directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.check_ins', 'insert,update,delete'),
  'authenticated clients cannot mutate check-ins directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.facility_statuses', 'insert,update,delete'),
  'authenticated clients cannot mutate statuses directly'
);

select ok(
  not has_column_privilege('authenticated', 'public.facilities', 'created_by', 'select')
  and not has_column_privilege('authenticated', 'public.facilities', 'updated_by', 'select'),
  'facility audit user identifiers are not exposed to mobile clients'
);

select ok(
  has_table_privilege('authenticated', 'public.facility_activity', 'select'),
  'authenticated clients can read the safe activity projection'
);

select ok(
  not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in (
        'profiles',
        'user_roles',
        'facilities',
        'facility_geofences',
        'check_ins',
        'facility_statuses'
      )
  ),
  'sensitive/raw application tables are not published to Realtime'
);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'facility_activity'
  ),
  'facility_activity is published to Realtime'
);

select ok(
  to_regprocedure('public.check_in(uuid,double precision,double precision)') is not null,
  'secure check-in RPC exists'
);
select ok(
  to_regprocedure('public.check_out()') is not null,
  'manual checkout RPC exists'
);
select ok(
  to_regprocedure('public.post_facility_status(uuid,public.facility_status_type)') is not null,
  'facility status RPC exists'
);
select ok(
  to_regprocedure('public.admin_save_facility(uuid,text,text,double precision,double precision,text,integer,boolean,boolean,boolean,boolean,text,double precision,double precision,integer)') is not null,
  'admin facility save RPC exists'
);
select ok(
  to_regprocedure('public.expire_due_records()') is not null,
  'expiry maintenance function exists'
);

select is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_enum as enum_value
    join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace as schemas on schemas.oid = enum_type.typnamespace
    where schemas.nspname = 'public'
      and enum_type.typname = 'facility_status_type'
  ),
  'courts_closed,tournament_at_courts',
  'facility status enum contains only approved values'
);

select is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_enum as enum_value
    join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace as schemas on schemas.oid = enum_type.typnamespace
    where schemas.nspname = 'public'
      and enum_type.typname = 'experience_level'
  ),
  'newbie,beginner,intermediate,advanced,pro',
  'experience enum contains only approved values'
);

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'courtcheck-expire-due-records'
      and schedule = '* * * * *'
  ),
  'expiry maintenance is scheduled every minute'
);

select ok(
  (
    select bool_and(functions.prosecdef)
    from pg_proc as functions
    where functions.oid in (
      'public.check_in(uuid,double precision,double precision)'::regprocedure,
      'public.check_out()'::regprocedure,
      'public.post_facility_status(uuid,public.facility_status_type)'::regprocedure,
      'public.admin_save_facility(uuid,text,text,double precision,double precision,text,integer,boolean,boolean,boolean,boolean,text,double precision,double precision,integer)'::regprocedure,
      'public.admin_set_facility_active(uuid,boolean)'::regprocedure,
      'public.expire_due_records()'::regprocedure
    )
  ),
  'sensitive functions are security definer functions'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.check_in(uuid,double precision,double precision)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.check_out()',
    'execute'
  ),
  'authenticated clients can execute canonical check-in functions'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.check_in(uuid,double precision,double precision)',
    'execute'
  ),
  'anonymous clients cannot execute secure check-in'
);

select * from finish();
rollback;
