begin;

create index if not exists facility_statuses_author_active_lookup
  on public.facility_statuses (
    facility_id,
    author_user_id,
    status_type,
    expires_at
  )
  where ended_at is null;

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
  v_status public.facility_statuses%rowtype;
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

  -- This row is both the authorization source and the per-user serialization
  -- point. It prevents checkout/expiry from racing the status decision and
  -- makes concurrent identical submissions observe the first inserted report.
  perform 1
  from public.check_ins as check_ins
  where check_ins.user_id = v_user_id
    and check_ins.facility_id = p_facility_id
    and check_ins.checked_out_at is null
    and check_ins.expires_at > v_now
  for update of check_ins;

  if not found then
    raise exception 'Active check-in at facility required' using errcode = '42501';
  end if;

  select statuses.*
  into v_status
  from public.facility_statuses as statuses
  where statuses.facility_id = p_facility_id
    and statuses.author_user_id = v_user_id
    and statuses.status_type = p_status_type
    and statuses.ended_at is null
    and statuses.expires_at > v_now
  order by statuses.created_at, statuses.id
  limit 1;

  if found then
    return query
    select
      v_status.id,
      v_status.facility_id,
      v_status.status_type,
      v_status.created_at,
      v_status.expires_at;
    return;
  end if;

  v_expires_at := v_now + case p_status_type
    when 'courts_closed' then interval '4 hours'
    when 'tournament_at_courts' then interval '8 hours'
  end;

  insert into public.facility_statuses as statuses (
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
  returning statuses.* into v_status;

  return query
  select
    v_status.id,
    v_status.facility_id,
    v_status.status_type,
    v_status.created_at,
    v_status.expires_at;
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
          when 'tournament_at_courts' then 2
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

-- PostgreSQL cannot change a RETURNS TABLE shape with CREATE OR REPLACE.
drop function public.list_facilities(
  text,
  double precision,
  double precision,
  double precision,
  double precision
);

create function public.list_facilities(
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
  activity_state text,
  activity_reporter_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
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
      when statuses.closed_reporter_count > 0 then 'courts_closed'
      when statuses.tournament_reporter_count > 0 then 'tournament_at_courts'
      when activity.active_check_in_count > 0 then 'active'
      else 'quiet'
    end,
    case
      when statuses.closed_reporter_count > 0 then statuses.closed_reporter_count
      when statuses.tournament_reporter_count > 0 then statuses.tournament_reporter_count
      else 0
    end
  from public.facilities as facilities
  cross join lateral (
    select count(*)::integer as active_check_in_count
    from public.check_ins as check_ins
    where check_ins.facility_id = facilities.id
      and check_ins.checked_out_at is null
      and check_ins.expires_at > v_now
  ) as activity
  cross join lateral (
    select
      count(distinct statuses.author_user_id) filter (
        where statuses.status_type = 'courts_closed'
      )::integer as closed_reporter_count,
      count(distinct statuses.author_user_id) filter (
        where statuses.status_type = 'tournament_at_courts'
      )::integer as tournament_reporter_count
    from public.facility_statuses as statuses
    where statuses.facility_id = facilities.id
      and statuses.ended_at is null
      and statuses.expires_at > v_now
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

revoke all on function public.post_facility_status(
  uuid,
  public.facility_status_type
) from public, anon, authenticated;
revoke all on function public.get_facility_detail(uuid)
  from public, anon, authenticated;
revoke all on function public.list_facilities(
  text,
  double precision,
  double precision,
  double precision,
  double precision
) from public, anon, authenticated;

grant execute on function public.post_facility_status(
  uuid,
  public.facility_status_type
) to authenticated;
grant execute on function public.get_facility_detail(uuid)
  to authenticated;
grant execute on function public.list_facilities(
  text,
  double precision,
  double precision,
  double precision,
  double precision
) to authenticated;

commit;
