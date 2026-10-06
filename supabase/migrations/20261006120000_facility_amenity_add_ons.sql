begin;

alter table public.facilities
  add column has_paddle_system boolean not null default false,
  add column has_court_rental_available boolean not null default false,
  add column has_permanent_lines_nets boolean not null default false,
  add column has_temporary_courts boolean not null default false,
  add column has_benches boolean not null default false;

create or replace function public.admin_get_facility(p_facility_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'id', facilities.id,
    'name', facilities.name,
    'address', facilities.address,
    'latitude', extensions.st_y(facilities.location::extensions.geometry),
    'longitude', extensions.st_x(facilities.location::extensions.geometry),
    'hoursText', facilities.hours_text,
    'courtCount', facilities.court_count,
    'hasLights', facilities.has_lights,
    'hasRestrooms', facilities.has_restrooms,
    'hasWater', facilities.has_water,
    'hasPaddleSystem', facilities.has_paddle_system,
    'hasCourtRentalAvailable', facilities.has_court_rental_available,
    'hasPermanentLinesNets', facilities.has_permanent_lines_nets,
    'hasTemporaryCourts', facilities.has_temporary_courts,
    'hasBenches', facilities.has_benches,
    'isActive', facilities.is_active,
    'verifiedBy', facilities.verified_by,
    'geofence', case
      when geofences.facility_id is null then null
      else pg_catalog.jsonb_build_object(
        'latitude', extensions.st_y(geofences.center::extensions.geometry),
        'longitude', extensions.st_x(geofences.center::extensions.geometry),
        'radiusM', geofences.radius_m
      )
    end,
    'createdAt', facilities.created_at,
    'updatedAt', facilities.updated_at
  )
  into v_result
  from public.facilities as facilities
  left join public.facility_geofences as geofences
    on geofences.facility_id = facilities.id
  where facilities.id = p_facility_id;

  if v_result is null then
    raise exception 'Facility not found' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

create or replace function public.get_facility_detail(p_facility_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_result jsonb;
begin
  if not public.current_user_has_account() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'id', facilities.id,
    'name', facilities.name,
    'address', facilities.address,
    'latitude', extensions.st_y(facilities.location::extensions.geometry),
    'longitude', extensions.st_x(facilities.location::extensions.geometry),
    'hoursText', facilities.hours_text,
    'courtCount', facilities.court_count,
    'hasLights', facilities.has_lights,
    'hasRestrooms', facilities.has_restrooms,
    'hasWater', facilities.has_water,
    'hasPaddleSystem', facilities.has_paddle_system,
    'hasCourtRentalAvailable', facilities.has_court_rental_available,
    'hasPermanentLinesNets', facilities.has_permanent_lines_nets,
    'hasTemporaryCourts', facilities.has_temporary_courts,
    'hasBenches', facilities.has_benches,
    'isActive', facilities.is_active,
    'verifiedBy', facilities.verified_by,
    'activeCheckInCount', (
      select count(*)
      from public.check_ins as check_ins
      where check_ins.facility_id = facilities.id
        and check_ins.checked_out_at is null
        and check_ins.expires_at > v_now
    ),
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'anonymousUsername', profiles.anonymous_username,
          'experienceLevel', profiles.experience_level
        )
        order by check_ins.checked_in_at
      )
      from public.check_ins as check_ins
      join public.profiles as profiles on profiles.id = check_ins.user_id
      where check_ins.facility_id = facilities.id
        and check_ins.checked_out_at is null
        and check_ins.expires_at > v_now
    ), '[]'::jsonb),
    'statuses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type', status_counts.status_type,
          'reporterCount', status_counts.reporter_count,
          'latestReportedAt', status_counts.latest_reported_at,
          'expiresAt', status_counts.expires_at
        )
        order by case status_counts.status_type
          when 'courts_closed' then 1
          when 'maintenance' then 2
          when 'courts_wet_unsafe' then 3
          when 'tournament_at_courts' then 4
          when 'courts_full' then 5
        end
      )
      from (
        select
          statuses.status_type,
          count(distinct statuses.author_user_id)::integer as reporter_count,
          max(statuses.created_at) as latest_reported_at,
          max(statuses.expires_at) as expires_at
        from public.facility_statuses as statuses
        where statuses.facility_id = facilities.id
          and statuses.ended_at is null
          and statuses.expires_at > v_now
        group by statuses.status_type
      ) as status_counts
    ), '[]'::jsonb)
  )
  into v_result
  from public.facilities as facilities
  where facilities.id = p_facility_id
    and (facilities.is_active or public.current_user_is_admin());

  if v_result is null then
    raise exception 'Facility not found' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

create function public.admin_save_facility_with_amenities(
  p_facility_id uuid,
  p_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_hours_text text,
  p_court_count integer,
  p_has_lights boolean,
  p_has_restrooms boolean,
  p_has_water boolean,
  p_is_active boolean,
  p_verified_by text,
  p_geofence_latitude double precision,
  p_geofence_longitude double precision,
  p_geofence_radius_m integer,
  p_has_paddle_system boolean,
  p_has_court_rental_available boolean,
  p_has_permanent_lines_nets boolean,
  p_has_temporary_courts boolean,
  p_has_benches boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_facility_id uuid;
begin
  if v_user_id is null or not public.current_user_is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  if p_has_paddle_system is null
    or p_has_court_rental_available is null
    or p_has_permanent_lines_nets is null
    or p_has_temporary_courts is null
    or p_has_benches is null then
    raise exception 'Amenity choices are required' using errcode = '22023';
  end if;

  v_facility_id := public.admin_save_facility(
    p_facility_id,
    p_name,
    p_address,
    p_latitude,
    p_longitude,
    p_hours_text,
    p_court_count,
    p_has_lights,
    p_has_restrooms,
    p_has_water,
    p_is_active,
    p_verified_by,
    p_geofence_latitude,
    p_geofence_longitude,
    p_geofence_radius_m
  );

  update public.facilities as facilities
  set
    has_paddle_system = p_has_paddle_system,
    has_court_rental_available = p_has_court_rental_available,
    has_permanent_lines_nets = p_has_permanent_lines_nets,
    has_temporary_courts = p_has_temporary_courts,
    has_benches = p_has_benches
  where facilities.id = v_facility_id;

  return v_facility_id;
end;
$$;

revoke all on function public.admin_save_facility_with_amenities(
  uuid, text, text, double precision, double precision, text, integer,
  boolean, boolean, boolean, boolean, text, double precision, double precision,
  integer, boolean, boolean, boolean, boolean, boolean
) from public, anon, authenticated;

grant execute on function public.admin_save_facility_with_amenities(
  uuid, text, text, double precision, double precision, text, integer,
  boolean, boolean, boolean, boolean, text, double precision, double precision,
  integer, boolean, boolean, boolean, boolean, boolean
) to authenticated;

revoke all on function public.admin_get_facility(uuid)
from public, anon, authenticated;
grant execute on function public.admin_get_facility(uuid) to authenticated;

revoke all on function public.get_facility_detail(uuid)
from public, anon, authenticated;
grant execute on function public.get_facility_detail(uuid) to authenticated;

commit;
