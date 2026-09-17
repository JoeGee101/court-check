begin;

create function public.admin_get_facility(p_facility_id uuid)
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

revoke all on function public.admin_get_facility(uuid)
from public, anon, authenticated;

grant execute on function public.admin_get_facility(uuid) to authenticated;

commit;
