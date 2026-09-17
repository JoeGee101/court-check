begin;

create function public.admin_delete_facility(p_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  -- Serialize deletion with facility edits and with new dependent rows. The
  -- foreign keys take key-share locks when activity is inserted, so no new
  -- history can appear between these checks and the facility deletion.
  perform 1
  from public.facilities as facilities
  where facilities.id = p_facility_id
  for update of facilities;

  if not found then
    raise exception 'Facility not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.check_ins as check_ins
    where check_ins.facility_id = p_facility_id
  ) or exists (
    select 1
    from public.facility_statuses as statuses
    where statuses.facility_id = p_facility_id
  ) then
    raise exception 'Facility has activity history' using errcode = '23503';
  end if;

  -- These rows contain configuration or derived state, not player history.
  -- Delete the geofence first because its trigger refreshes the projection.
  delete from public.facility_geofences as geofences
  where geofences.facility_id = p_facility_id;

  delete from public.facility_activity as activity
  where activity.facility_id = p_facility_id;

  delete from public.facilities as facilities
  where facilities.id = p_facility_id;
end;
$$;

revoke all on function public.admin_delete_facility(uuid)
from public, anon, authenticated;

grant execute on function public.admin_delete_facility(uuid) to authenticated;

commit;
