begin;

create or replace function public.refresh_facility_activity(p_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.facility_activity as activity (
    facility_id,
    active_check_in_count,
    revision,
    updated_at
  )
  select
    facilities.id,
    count(check_ins.id)::integer,
    1,
    statement_timestamp()
  from public.facilities as facilities
  left join public.check_ins as check_ins
    on check_ins.facility_id = facilities.id
   and check_ins.checked_out_at is null
   and check_ins.expires_at > now()
  where facilities.id = p_facility_id
  group by facilities.id
  on conflict (facility_id) do update
  set
    active_check_in_count = excluded.active_check_in_count,
    revision = activity.revision + 1,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.handle_facility_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_facility_activity(old.facility_id);
    return old;
  end if;

  perform public.refresh_facility_activity(new.facility_id);

  if tg_op = 'UPDATE' and old.facility_id is distinct from new.facility_id then
    perform public.refresh_facility_activity(old.facility_id);
  end if;

  return new;
end;
$$;

create or replace function public.handle_facility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_facility_activity(new.id);
  return new;
end;
$$;

create trigger facilities_refresh_activity
after insert or update on public.facilities
for each row execute function public.handle_facility_change();

create trigger facility_geofences_refresh_activity
after insert or update or delete on public.facility_geofences
for each row execute function public.handle_facility_activity_change();

create trigger check_ins_refresh_activity
after insert or update or delete on public.check_ins
for each row execute function public.handle_facility_activity_change();

create trigger facility_statuses_refresh_activity
after insert or update or delete on public.facility_statuses
for each row execute function public.handle_facility_activity_change();

create or replace function public.rebuild_facility_activity(p_facility_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_facility_id uuid;
begin
  for v_facility_id in
    select facilities.id
    from public.facilities as facilities
    where p_facility_id is null or facilities.id = p_facility_id
  loop
    perform public.refresh_facility_activity(v_facility_id);
  end loop;
end;
$$;

create or replace function public.list_facilities(
  p_search text default null,
  p_min_latitude double precision default null,
  p_min_longitude double precision default null,
  p_max_latitude double precision default null,
  p_max_longitude double precision default null
)
returns table (
  id uuid,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  hours_text text,
  court_count integer,
  has_lights boolean,
  has_restrooms boolean,
  has_water boolean,
  verified_by text,
  active_check_in_count integer,
  activity_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_has_no_bounds boolean :=
    p_min_latitude is null
    and p_min_longitude is null
    and p_max_latitude is null
    and p_max_longitude is null;
  v_has_all_bounds boolean :=
    p_min_latitude is not null
    and p_min_longitude is not null
    and p_max_latitude is not null
    and p_max_longitude is not null;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not v_has_no_bounds and not v_has_all_bounds then
    raise exception 'Map bounds must be supplied together' using errcode = '22023';
  end if;

  if v_has_all_bounds and (
    p_min_latitude not between -90 and 90
    or p_max_latitude not between -90 and 90
    or p_min_longitude not between -180 and 180
    or p_max_longitude not between -180 and 180
    or p_min_latitude > p_max_latitude
    or p_min_longitude > p_max_longitude
  ) then
    raise exception 'Invalid map bounds' using errcode = '22023';
  end if;

  return query
  select
    facilities.id,
    facilities.name,
    facilities.address,
    extensions.st_y(facilities.location::extensions.geometry),
    extensions.st_x(facilities.location::extensions.geometry),
    facilities.hours_text,
    facilities.court_count,
    facilities.has_lights,
    facilities.has_restrooms,
    facilities.has_water,
    facilities.verified_by,
    activity.active_check_in_count,
    case
      when statuses.has_closed_status then 'courts_closed'
      when statuses.has_tournament_status then 'tournament_at_courts'
      when activity.active_check_in_count > 0 then 'active'
      else 'quiet'
    end
  from public.facilities as facilities
  cross join lateral (
    select count(*)::integer as active_check_in_count
    from public.check_ins as check_ins
    where check_ins.facility_id = facilities.id
      and check_ins.checked_out_at is null
      and check_ins.expires_at > now()
  ) as activity
  cross join lateral (
    select
      exists (
        select 1
        from public.facility_statuses as closed_statuses
        where closed_statuses.facility_id = facilities.id
          and closed_statuses.status_type = 'courts_closed'
          and closed_statuses.ended_at is null
          and closed_statuses.expires_at > now()
      ) as has_closed_status,
      exists (
        select 1
        from public.facility_statuses as tournament_statuses
        where tournament_statuses.facility_id = facilities.id
          and tournament_statuses.status_type = 'tournament_at_courts'
          and tournament_statuses.ended_at is null
          and tournament_statuses.expires_at > now()
      ) as has_tournament_status
  ) as statuses
  where facilities.is_active
    and (
      p_search is null
      or btrim(p_search) = ''
      or facilities.name ilike '%' || btrim(p_search) || '%'
      or facilities.address ilike '%' || btrim(p_search) || '%'
    )
    and (
      v_has_no_bounds
      or (
        extensions.st_y(facilities.location::extensions.geometry)
          between p_min_latitude and p_max_latitude
        and extensions.st_x(facilities.location::extensions.geometry)
          between p_min_longitude and p_max_longitude
      )
    )
  order by facilities.name;
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
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
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
    'activeCheckInCount', (
      select count(*)
      from public.check_ins as check_ins
      where check_ins.facility_id = facilities.id
        and check_ins.checked_out_at is null
        and check_ins.expires_at > now()
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
        and check_ins.expires_at > now()
    ), '[]'::jsonb),
    'statuses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'type', statuses.status_type,
          'authorUsername', profiles.anonymous_username,
          'createdAt', statuses.created_at,
          'expiresAt', statuses.expires_at
        )
        order by statuses.created_at desc
      )
      from public.facility_statuses as statuses
      join public.profiles as profiles on profiles.id = statuses.author_user_id
      where statuses.facility_id = facilities.id
        and statuses.ended_at is null
        and statuses.expires_at > now()
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

create or replace function public.list_my_check_in_history(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  facility_id uuid,
  facility_name text,
  checked_in_at timestamptz,
  expires_at timestamptz,
  checked_out_at timestamptz,
  checkout_reason public.checkout_reason
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'Invalid pagination' using errcode = '22023';
  end if;

  return query
  select
    check_ins.id,
    check_ins.facility_id,
    facilities.name,
    check_ins.checked_in_at,
    check_ins.expires_at,
    check_ins.checked_out_at,
    check_ins.checkout_reason
  from public.check_ins as check_ins
  join public.facilities as facilities on facilities.id = check_ins.facility_id
  where check_ins.user_id = v_user_id
  order by check_ins.checked_in_at desc
  limit p_limit
  offset p_offset;
end;
$$;

create or replace function public.check_in(
  p_facility_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns table (
  id uuid,
  facility_id uuid,
  checked_in_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_geofence_center extensions.geography;
  v_geofence_radius integer;
  v_device_point extensions.geography;
  v_check_in_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users as users
    join public.profiles as profiles on profiles.id = users.id
    where users.id = v_user_id
      and users.phone is not null
      and users.phone_confirmed_at is not null
      and profiles.onboarding_completed_at is not null
  ) then
    raise exception 'Completed phone-verified account required' using errcode = '42501';
  end if;

  select geofences.center, geofences.radius_m
  into v_geofence_center, v_geofence_radius
  from public.facilities as facilities
  join public.facility_geofences as geofences
    on geofences.facility_id = facilities.id
  where facilities.id = p_facility_id
    and facilities.is_active
  for share of facilities, geofences;

  if not found then
    raise exception 'Active facility with geofence not found' using errcode = 'P0002';
  end if;

  v_device_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;

  if not extensions.st_dwithin(
    v_device_point,
    v_geofence_center,
    v_geofence_radius
  ) then
    raise exception 'Outside facility geofence' using errcode = '42501';
  end if;

  -- Facility locks precede dependent-row locks everywhere that can change
  -- facility lifecycle state, avoiding a check-in/deactivation deadlock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  update public.check_ins as check_ins
  set
    checked_out_at = check_ins.expires_at,
    checkout_reason = 'expired'
  where check_ins.user_id = v_user_id
    and check_ins.checked_out_at is null
    and check_ins.expires_at <= v_now;

  if exists (
    select 1
    from public.check_ins as check_ins
    where check_ins.user_id = v_user_id
      and check_ins.checked_out_at is null
      and check_ins.expires_at > v_now
  ) then
    raise exception 'User already has an open check-in' using errcode = '23505';
  end if;

  insert into public.check_ins (
    user_id,
    facility_id,
    checked_in_at,
    expires_at
  )
  values (
    v_user_id,
    p_facility_id,
    v_now,
    v_now + interval '90 minutes'
  )
  returning check_ins.id into v_check_in_id;

  return query
  select v_check_in_id, p_facility_id, v_now, v_now + interval '90 minutes';
end;
$$;

create or replace function public.check_out()
returns table (
  id uuid,
  facility_id uuid,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  checkout_reason public.checkout_reason
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_check_in public.check_ins%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select check_ins.*
  into v_check_in
  from public.check_ins as check_ins
  where check_ins.user_id = v_user_id
    and check_ins.checked_out_at is null
  for update;

  if not found then
    raise exception 'No open check-in found' using errcode = 'P0002';
  end if;

  update public.check_ins as check_ins
  set
    checked_out_at = case
      when v_check_in.expires_at <= v_now then v_check_in.expires_at
      else v_now
    end,
    checkout_reason = case
      when v_check_in.expires_at <= v_now then 'expired'::public.checkout_reason
      else 'manual'::public.checkout_reason
    end
  where check_ins.id = v_check_in.id
  returning check_ins.* into v_check_in;

  return query
  select
    v_check_in.id,
    v_check_in.facility_id,
    v_check_in.checked_in_at,
    v_check_in.checked_out_at,
    v_check_in.checkout_reason;
end;
$$;

create or replace function public.post_facility_status(
  p_facility_id uuid,
  p_status_type public.facility_status_type
)
returns table (
  id uuid,
  facility_id uuid,
  status_type public.facility_status_type,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_expires_at timestamptz;
  v_status_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles as profiles
    where profiles.id = v_user_id
      and profiles.onboarding_completed_at is not null
  ) then
    raise exception 'Completed account required' using errcode = '42501';
  end if;

  perform 1
  from public.facilities as facilities
  where facilities.id = p_facility_id
    and facilities.is_active
  for share of facilities;

  if not found then
    raise exception 'Active facility not found' using errcode = 'P0002';
  end if;

  v_expires_at := v_now + case p_status_type
    when 'courts_closed' then interval '4 hours'
    when 'tournament_at_courts' then interval '8 hours'
  end;

  insert into public.facility_statuses (
    facility_id,
    author_user_id,
    status_type,
    created_at,
    expires_at
  )
  values (
    p_facility_id,
    v_user_id,
    p_status_type,
    v_now,
    v_expires_at
  )
  returning facility_statuses.id into v_status_id;

  return query
  select v_status_id, p_facility_id, p_status_type, v_now, v_expires_at;
end;
$$;

create or replace function public.admin_save_facility(
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
  p_geofence_radius_m integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_facility_id uuid := coalesce(p_facility_id, gen_random_uuid());
  v_location extensions.geography;
  v_geofence_center extensions.geography;
begin
  if v_user_id is null or not public.current_user_is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = ''
    or p_address is null or btrim(p_address) = ''
    or p_hours_text is null or btrim(p_hours_text) = '' then
    raise exception 'Name, address, and hours are required' using errcode = '22023';
  end if;

  if p_court_count is null or p_court_count < 0 then
    raise exception 'Court count must be nonnegative' using errcode = '22023';
  end if;

  if p_is_active is null then
    raise exception 'Facility active state is required' using errcode = '22023';
  end if;

  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180
    or p_geofence_latitude is null or p_geofence_latitude not between -90 and 90
    or p_geofence_longitude is null or p_geofence_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if p_geofence_radius_m is null or p_geofence_radius_m not between 10 and 1000 then
    raise exception 'Geofence radius must be between 10 and 1000 meters'
      using errcode = '22023';
  end if;

  v_location := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;
  v_geofence_center := extensions.st_setsrid(
    extensions.st_makepoint(p_geofence_longitude, p_geofence_latitude),
    4326
  )::extensions.geography;

  -- Deactivate before editing an existing facility. This preserves the lock
  -- order used by expiry work: dependent rows, then the activity projection.
  if p_facility_id is not null and not p_is_active then
    perform public.admin_set_facility_active(p_facility_id, false);
  end if;

  if p_facility_id is null then
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
      verified_by,
      created_by,
      updated_by
    )
    values (
      v_facility_id,
      btrim(p_name),
      btrim(p_address),
      v_location,
      btrim(p_hours_text),
      p_court_count,
      p_has_lights,
      p_has_restrooms,
      p_has_water,
      false,
      nullif(btrim(p_verified_by), ''),
      v_user_id,
      v_user_id
    );
  else
    update public.facilities as facilities
    set
      name = btrim(p_name),
      address = btrim(p_address),
      location = v_location,
      hours_text = btrim(p_hours_text),
      court_count = p_court_count,
      has_lights = p_has_lights,
      has_restrooms = p_has_restrooms,
      has_water = p_has_water,
      verified_by = nullif(btrim(p_verified_by), ''),
      updated_by = v_user_id
    where facilities.id = p_facility_id;

    if not found then
      raise exception 'Facility not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.facility_geofences (
    facility_id,
    center,
    radius_m,
    updated_by
  )
  values (
    v_facility_id,
    v_geofence_center,
    p_geofence_radius_m,
    v_user_id
  )
  on conflict (facility_id) do update
  set
    center = excluded.center,
    radius_m = excluded.radius_m,
    updated_by = excluded.updated_by;

  -- Existing deactivations already passed through the lifecycle function
  -- before facility/geofence edits acquired projection locks.
  if p_facility_id is null or p_is_active then
    perform public.admin_set_facility_active(v_facility_id, p_is_active);
  end if;

  return v_facility_id;
end;
$$;

create or replace function public.admin_set_facility_active(
  p_facility_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  if (select auth.uid()) is null or not public.current_user_is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  if p_is_active is null then
    raise exception 'Facility active state is required' using errcode = '22023';
  end if;

  perform 1
  from public.facilities as facilities
  where facilities.id = p_facility_id
  for update of facilities;

  if not found then
    raise exception 'Facility not found' using errcode = 'P0002';
  end if;

  if p_is_active and not exists (
    select 1
    from public.facility_geofences as geofences
    where geofences.facility_id = p_facility_id
  ) then
    raise exception 'A geofence is required before activation' using errcode = '23514';
  end if;

  if not p_is_active then
    update public.check_ins as check_ins
    set
      checked_out_at = case
        when check_ins.expires_at <= v_now then check_ins.expires_at
        else v_now
      end,
      checkout_reason = case
        when check_ins.expires_at <= v_now then 'expired'::public.checkout_reason
        else 'facility_deactivated'::public.checkout_reason
      end
    where check_ins.facility_id = p_facility_id
      and check_ins.checked_out_at is null;

    update public.facility_statuses as statuses
    set
      ended_at = case
        when statuses.expires_at <= v_now then statuses.expires_at
        else v_now
      end,
      end_reason = case
        when statuses.expires_at <= v_now
          then 'expired'::public.facility_status_end_reason
        else 'facility_deactivated'::public.facility_status_end_reason
      end
    where statuses.facility_id = p_facility_id
      and statuses.ended_at is null;
  end if;

  update public.facilities as facilities
  set
    is_active = p_is_active,
    updated_by = (select auth.uid())
  where facilities.id = p_facility_id;
end;
$$;

create or replace function public.expire_due_records()
returns table (check_ins_closed integer, statuses_ended integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check_ins_closed integer;
  v_statuses_ended integer;
begin
  update public.check_ins as check_ins
  set
    checked_out_at = check_ins.expires_at,
    checkout_reason = 'expired'
  where check_ins.checked_out_at is null
    and check_ins.expires_at <= now();

  get diagnostics v_check_ins_closed = row_count;

  update public.facility_statuses as statuses
  set
    ended_at = statuses.expires_at,
    end_reason = 'expired'
  where statuses.ended_at is null
    and statuses.expires_at <= now();

  get diagnostics v_statuses_ended = row_count;

  return query select v_check_ins_closed, v_statuses_ended;
end;
$$;

revoke all on function public.refresh_facility_activity(uuid) from public, anon, authenticated;
revoke all on function public.handle_facility_activity_change() from public, anon, authenticated;
revoke all on function public.handle_facility_change() from public, anon, authenticated;
revoke all on function public.rebuild_facility_activity(uuid) from public, anon, authenticated;
revoke all on function public.list_facilities(text, double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.get_facility_detail(uuid) from public, anon, authenticated;
revoke all on function public.list_my_check_in_history(integer, integer) from public, anon, authenticated;
revoke all on function public.check_in(uuid, double precision, double precision) from public, anon, authenticated;
revoke all on function public.check_out() from public, anon, authenticated;
revoke all on function public.post_facility_status(uuid, public.facility_status_type) from public, anon, authenticated;
revoke all on function public.admin_save_facility(uuid, text, text, double precision, double precision, text, integer, boolean, boolean, boolean, boolean, text, double precision, double precision, integer) from public, anon, authenticated;
revoke all on function public.admin_set_facility_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.expire_due_records() from public, anon, authenticated;

select public.rebuild_facility_activity();

commit;
