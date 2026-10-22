begin;

-- Facility history survives facility deletion as useful operational history,
-- while its facility association is removed. Snapshot the public facility
-- name before the FK nulls the relationship.
alter table public.check_ins
  add column facility_name_snapshot text,
  drop constraint check_ins_facility_id_fkey,
  add constraint check_ins_facility_id_fkey
    foreign key (facility_id) references public.facilities(id) on delete set null,
  add constraint check_ins_facility_context_required
    check (facility_id is not null or facility_name_snapshot is not null);

alter table public.facility_statuses
  add column facility_name_snapshot text,
  drop constraint facility_statuses_facility_id_fkey,
  add constraint facility_statuses_facility_id_fkey
    foreign key (facility_id) references public.facilities(id) on delete set null,
  add constraint facility_statuses_facility_context_required
    check (facility_id is not null or facility_name_snapshot is not null);

create table public.facility_feedback (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.profiles(id) on delete set null,
  facility_id uuid references public.facilities(id) on delete set null,
  facility_name_snapshot text,
  category text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  constraint facility_feedback_category check (category in ('missing_information', 'suggest_facility')),
  constraint facility_feedback_message_length check (char_length(btrim(message)) between 3 and 1000),
  constraint facility_feedback_status check (status in ('new', 'reviewed', 'resolved')),
  constraint facility_feedback_suggestion_has_no_facility check (category <> 'suggest_facility' or facility_id is null),
  constraint facility_feedback_missing_info_has_context check (
    category <> 'missing_information'
    or facility_id is not null
    or facility_name_snapshot is not null
  )
);

create index facility_feedback_created_at on public.facility_feedback(created_at desc);
create index facility_feedback_status_created_at on public.facility_feedback(status, created_at desc);
alter table public.facility_feedback enable row level security;
revoke all on table public.facility_feedback from public, anon, authenticated;

create trigger facility_feedback_set_updated_at
before update on public.facility_feedback
for each row execute function public.set_updated_at();

alter table public.facility_statuses
  drop constraint facility_statuses_fixed_expiry,
  add constraint facility_statuses_fixed_expiry
  check (
    expires_at = created_at + case status_type
      when 'courts_closed' then interval '4 hours'
      when 'maintenance' then interval '8 hours'
      when 'courts_wet_unsafe' then interval '2 hours'
      when 'tournament_at_courts' then interval '8 hours'
      when 'courts_full' then interval '1 hour'
      when 'league_in_progress' then interval '8 hours'
      when 'need_players' then interval '1 hour'
      when 'open_courts' then interval '1 hour'
      when 'short_wait' then interval '10 minutes'
      when 'long_wait' then interval '30 minutes'
      when 'lights_out_of_order' then interval '8 hours'
    end
  );

create or replace function public.admin_delete_facility(p_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_facility_name text;
  v_now timestamptz := statement_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.current_user_is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  select facilities.name
  into v_facility_name
  from public.facilities as facilities
  where facilities.id = p_facility_id
  for update of facilities;
  if not found then
    raise exception 'Facility not found' using errcode = 'P0002';
  end if;

  -- Stop current activity before the facility references are detached. The
  -- facility row lock blocks new check-ins/reports until this transaction ends.
  update public.check_ins as check_ins
  set
    checked_out_at = case when check_ins.expires_at <= v_now then check_ins.expires_at else v_now end,
    checkout_reason = case when check_ins.expires_at <= v_now then 'expired'::public.checkout_reason else 'facility_deactivated'::public.checkout_reason end,
    facility_name_snapshot = coalesce(check_ins.facility_name_snapshot, v_facility_name)
  where check_ins.facility_id = p_facility_id
    and check_ins.checked_out_at is null;

  update public.check_ins as check_ins
  set facility_name_snapshot = coalesce(check_ins.facility_name_snapshot, v_facility_name)
  where check_ins.facility_id = p_facility_id;

  update public.facility_statuses as statuses
  set
    ended_at = case when statuses.ended_at is null and statuses.expires_at <= v_now then statuses.expires_at when statuses.ended_at is null then v_now else statuses.ended_at end,
    end_reason = case when statuses.ended_at is null and statuses.expires_at <= v_now then 'expired'::public.facility_status_end_reason when statuses.ended_at is null then 'facility_deactivated'::public.facility_status_end_reason else statuses.end_reason end,
    facility_name_snapshot = coalesce(statuses.facility_name_snapshot, v_facility_name)
  where statuses.facility_id = p_facility_id;

  update public.facility_feedback as feedback
  set facility_name_snapshot = coalesce(feedback.facility_name_snapshot, v_facility_name)
  where feedback.facility_id = p_facility_id;

  delete from public.facility_geofences as geofences where geofences.facility_id = p_facility_id;
  delete from public.facility_activity as activity where activity.facility_id = p_facility_id;
  delete from public.facilities as facilities where facilities.id = p_facility_id;
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
  v_status public.facility_statuses%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_status_type is null or p_status_type in ('courts_full', 'courts_wet_unsafe') then
    raise exception 'This status is no longer available' using errcode = '22023';
  end if;

  perform 1 from public.profiles as profiles
  where profiles.id = v_user_id and profiles.onboarding_completed_at is not null
  for key share of profiles;
  if not found then
    raise exception 'Completed account required' using errcode = '42501';
  end if;

  perform 1 from public.facilities as facilities
  where facilities.id = p_facility_id and facilities.is_active
  for share of facilities;
  if not found then
    raise exception 'Active facility not found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  perform 1 from public.check_ins as check_ins
  where check_ins.user_id = v_user_id
    and check_ins.facility_id = p_facility_id
    and check_ins.checked_out_at is null
    and check_ins.expires_at > v_now
  for update of check_ins;
  if not found then
    raise exception 'Active check-in at facility required' using errcode = '42501';
  end if;

  select statuses.* into v_status
  from public.facility_statuses as statuses
  where statuses.facility_id = p_facility_id
    and statuses.author_user_id = v_user_id
    and statuses.status_type = p_status_type
    and statuses.ended_at is null
    and statuses.expires_at > v_now
  order by statuses.created_at, statuses.id
  limit 1;
  if found then
    return query select v_status.id, v_status.facility_id, v_status.status_type, v_status.created_at, v_status.expires_at;
    return;
  end if;

  v_expires_at := v_now + case p_status_type
    when 'courts_closed' then interval '4 hours'
    when 'maintenance' then interval '8 hours'
    when 'courts_wet_unsafe' then interval '2 hours'
    when 'tournament_at_courts' then interval '8 hours'
    when 'courts_full' then interval '1 hour'
    when 'league_in_progress' then interval '8 hours'
    when 'need_players' then interval '1 hour'
    when 'open_courts' then interval '1 hour'
    when 'short_wait' then interval '10 minutes'
    when 'long_wait' then interval '30 minutes'
    when 'lights_out_of_order' then interval '8 hours'
  end;

  insert into public.facility_statuses as statuses (facility_id, author_user_id, status_type, created_at, expires_at)
  values (p_facility_id, v_user_id, p_status_type, v_now, v_expires_at)
  returning statuses.* into v_status;
  return query select v_status.id, v_status.facility_id, v_status.status_type, v_status.created_at, v_status.expires_at;
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
  v_month_start timestamptz;
  v_month_key text;
  v_result jsonb;
begin
  v_month_start := pg_catalog.date_trunc('month', v_now at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  v_month_key := pg_catalog.to_char(v_now at time zone 'America/Los_Angeles', 'YYYY-MM');
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
    'activeCheckInCount', (select count(*) from public.check_ins as ci where ci.facility_id = facilities.id and ci.checked_out_at is null and ci.expires_at > v_now),
    'players', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('anonymousUsername', profiles.anonymous_username, 'experienceLevel', profiles.experience_level) order by ci.checked_in_at)
      from public.check_ins as ci join public.profiles as profiles on profiles.id = ci.user_id
      where ci.facility_id = facilities.id and ci.checked_out_at is null and ci.expires_at > v_now
    ), '[]'::jsonb),
    'leaderboardMonth', v_month_key,
    'monthlyLeaderboard', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('rank', ranked.rank, 'anonymousUsername', ranked.anonymous_username, 'experienceLevel', ranked.experience_level, 'totalSeconds', ranked.total_seconds) order by ranked.rank)
      from (
        select pg_catalog.row_number() over (order by totals.total_seconds desc, profiles.anonymous_username)::integer as rank,
          profiles.anonymous_username, profiles.experience_level, totals.total_seconds
        from (
          select ci.user_id, pg_catalog.floor(pg_catalog.sum(pg_catalog.date_part('epoch', (least(coalesce(ci.checked_out_at, v_now), ci.expires_at, v_now) - greatest(ci.checked_in_at, v_month_start)))))::bigint as total_seconds
          from public.check_ins as ci
          where ci.facility_id = facilities.id and ci.user_id is not null
            and ci.checked_in_at >= v_month_start - interval '90 minutes' and ci.checked_in_at < v_now
            and least(coalesce(ci.checked_out_at, v_now), ci.expires_at, v_now) > greatest(ci.checked_in_at, v_month_start)
          group by ci.user_id
        ) as totals join public.profiles as profiles on profiles.id = totals.user_id
        where totals.total_seconds > 0
        order by totals.total_seconds desc, profiles.anonymous_username
        limit 10
      ) as ranked
    ), '[]'::jsonb),
    'statuses', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('type', counts.status_type, 'reporterCount', counts.reporter_count, 'latestReportedAt', counts.latest_reported_at, 'expiresAt', counts.expires_at)
        order by case counts.status_type
          when 'courts_closed' then 1 when 'lights_out_of_order' then 2 when 'maintenance' then 3
          when 'league_in_progress' then 4 when 'tournament_at_courts' then 5 when 'long_wait' then 6
          when 'short_wait' then 7 when 'need_players' then 8 when 'open_courts' then 9
          when 'courts_wet_unsafe' then 10 when 'courts_full' then 11
        end)
      from (
        select statuses.status_type, count(distinct statuses.author_user_id)::integer as reporter_count,
          max(statuses.created_at) as latest_reported_at, max(statuses.expires_at) as expires_at
        from public.facility_statuses as statuses
        where statuses.facility_id = facilities.id and statuses.ended_at is null and statuses.expires_at > v_now
        group by statuses.status_type
      ) as counts
    ), '[]'::jsonb)
  ) into v_result
  from public.facilities as facilities
  where facilities.id = p_facility_id and (facilities.is_active or public.current_user_is_admin());

  if v_result is null then raise exception 'Facility not found' using errcode = 'P0002'; end if;
  return v_result;
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
  id uuid, name text, address text, latitude double precision, longitude double precision,
  hours_text text, court_count integer, has_lights boolean, has_restrooms boolean,
  has_water boolean, verified_by text, active_check_in_count integer,
  activity_state text, activity_reporter_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_no_bounds boolean := p_min_latitude is null and p_min_longitude is null and p_max_latitude is null and p_max_longitude is null;
  v_all_bounds boolean := p_min_latitude is not null and p_min_longitude is not null and p_max_latitude is not null and p_max_longitude is not null;
begin
  if not public.current_user_has_account() then raise exception 'Active account required' using errcode = '42501'; end if;
  if not v_no_bounds and not v_all_bounds then raise exception 'Map bounds must be supplied together' using errcode = '22023'; end if;
  if v_all_bounds and (
    p_min_latitude not between -90 and 90 or p_max_latitude not between -90 and 90
    or p_min_longitude not between -180 and 180 or p_max_longitude not between -180 and 180
    or p_min_latitude > p_max_latitude or p_min_longitude > p_max_longitude
  ) then raise exception 'Invalid map bounds' using errcode = '22023'; end if;

  return query
  select facilities.id, facilities.name, facilities.address,
    extensions.st_y(facilities.location::extensions.geometry), extensions.st_x(facilities.location::extensions.geometry),
    facilities.hours_text, facilities.court_count, facilities.has_lights, facilities.has_restrooms,
    facilities.has_water, facilities.verified_by, activity.active_check_in_count,
    case
      when statuses.closed_count > 0 then 'courts_closed'
      when statuses.lights_count > 0 then 'lights_out_of_order'
      when statuses.maintenance_count > 0 then 'maintenance'
      when statuses.league_count > 0 then 'league_in_progress'
      when statuses.tournament_count > 0 then 'tournament_at_courts'
      when statuses.long_wait_count > 0 then 'long_wait'
      when statuses.short_wait_count > 0 then 'short_wait'
      when statuses.need_players_count > 0 then 'need_players'
      when statuses.open_count > 0 then 'open_courts'
      when statuses.wet_count > 0 then 'courts_wet_unsafe'
      when statuses.full_count > 0 then 'courts_full'
      when activity.active_check_in_count > 0 then 'active' else 'quiet' end,
    case
      when statuses.closed_count > 0 then statuses.closed_count
      when statuses.lights_count > 0 then statuses.lights_count
      when statuses.maintenance_count > 0 then statuses.maintenance_count
      when statuses.league_count > 0 then statuses.league_count
      when statuses.tournament_count > 0 then statuses.tournament_count
      when statuses.long_wait_count > 0 then statuses.long_wait_count
      when statuses.short_wait_count > 0 then statuses.short_wait_count
      when statuses.need_players_count > 0 then statuses.need_players_count
      when statuses.open_count > 0 then statuses.open_count
      when statuses.wet_count > 0 then statuses.wet_count
      when statuses.full_count > 0 then statuses.full_count else 0 end
  from public.facilities as facilities
  cross join lateral (
    select count(*)::integer as active_check_in_count
    from public.check_ins as ci
    where ci.facility_id = facilities.id and ci.checked_out_at is null and ci.expires_at > v_now
  ) as activity
  cross join lateral (
    select
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'courts_closed')::integer as closed_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'lights_out_of_order')::integer as lights_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'maintenance')::integer as maintenance_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'league_in_progress')::integer as league_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'tournament_at_courts')::integer as tournament_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'long_wait')::integer as long_wait_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'short_wait')::integer as short_wait_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'need_players')::integer as need_players_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'open_courts')::integer as open_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'courts_wet_unsafe')::integer as wet_count,
      count(distinct statuses.author_user_id) filter (where statuses.status_type = 'courts_full')::integer as full_count
    from public.facility_statuses as statuses
    where statuses.facility_id = facilities.id and statuses.ended_at is null and statuses.expires_at > v_now
  ) as statuses
  where facilities.is_active
    and (p_search is null or btrim(p_search) = '' or facilities.name ilike '%' || btrim(p_search) || '%' or facilities.address ilike '%' || btrim(p_search) || '%')
    and (v_no_bounds or (extensions.st_y(facilities.location::extensions.geometry) between p_min_latitude and p_max_latitude and extensions.st_x(facilities.location::extensions.geometry) between p_min_longitude and p_max_longitude))
  order by facilities.name;
end;
$$;

create or replace function public.list_my_check_in_history(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, facility_id uuid, facility_name text, checked_in_at timestamptz,
  expires_at timestamptz, checked_out_at timestamptz, checkout_reason public.checkout_reason
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'Invalid pagination' using errcode = '22023'; end if;
  return query
  select ci.id, ci.facility_id, coalesce(facilities.name, ci.facility_name_snapshot, 'Deleted facility'),
    ci.checked_in_at, ci.expires_at, ci.checked_out_at, ci.checkout_reason
  from public.check_ins as ci
  left join public.facilities as facilities on facilities.id = ci.facility_id
  where ci.user_id = v_user_id
  order by ci.checked_in_at desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.get_my_play_time_summary()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_week_start timestamptz;
  v_weekly_seconds bigint;
  v_recent_sessions jsonb;
begin
  if v_user_id is null or not public.current_user_has_account() then raise exception 'Active account required' using errcode = '42501'; end if;
  v_week_start := v_now - interval '7 days';
  select floor(coalesce(
    sum(extract(epoch from (
      least(coalesce(ci.checked_out_at, v_now), ci.expires_at, v_now)
      - greatest(ci.checked_in_at, v_week_start)
    ))),
    0
  ))::bigint
  into v_weekly_seconds
  from public.check_ins as ci
  where ci.user_id = v_user_id and ci.checked_in_at < v_now
    and least(coalesce(ci.checked_out_at, v_now), ci.expires_at, v_now) > v_week_start;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'facilityName', sessions.facility_name, 'checkedInAt', sessions.checked_in_at,
    'durationSeconds', sessions.duration_seconds, 'isActive', sessions.is_active
  ) order by sessions.checked_in_at desc), '[]'::jsonb)
  into v_recent_sessions
  from (
    select coalesce(facilities.name, ci.facility_name_snapshot, 'Deleted facility') as facility_name,
      ci.checked_in_at,
      floor(extract(epoch from (least(coalesce(ci.checked_out_at, v_now), ci.expires_at, v_now) - ci.checked_in_at)))::bigint as duration_seconds,
      ci.checked_out_at is null and ci.expires_at > v_now as is_active
    from public.check_ins as ci
    left join public.facilities as facilities on facilities.id = ci.facility_id
    where ci.user_id = v_user_id and ci.checked_in_at < v_now
    order by ci.checked_in_at desc limit 3
  ) as sessions;
  return pg_catalog.jsonb_build_object('weeklySeconds', coalesce(v_weekly_seconds, 0), 'recentSessions', v_recent_sessions);
end;
$$;

create function public.submit_facility_feedback(p_category text, p_facility_id uuid, p_message text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_facility_name text;
  v_message text := btrim(coalesce(p_message, ''));
  v_feedback_id uuid;
begin
  if v_user_id is null or not public.current_user_has_account() then raise exception 'Active account required' using errcode = '42501'; end if;
  perform 1
  from public.profiles as profiles
  where profiles.id = v_user_id and profiles.onboarding_completed_at is not null
  for key share of profiles;
  if not found then raise exception 'Completed account required' using errcode = '42501'; end if;
  if p_category is null or p_category not in ('missing_information', 'suggest_facility') or char_length(v_message) not between 3 and 1000 then raise exception 'Invalid feedback' using errcode = '22023'; end if;
  if p_category = 'missing_information' then
    if p_facility_id is null then raise exception 'Facility required' using errcode = '22023'; end if;
    select facilities.name into v_facility_name from public.facilities as facilities where facilities.id = p_facility_id and facilities.is_active;
    if not found then raise exception 'Active facility not found' using errcode = 'P0002'; end if;
  elsif p_facility_id is not null then
    raise exception 'New park suggestions cannot include a facility ID' using errcode = '22023';
  end if;

  if (select count(*) from public.facility_feedback as feedback where feedback.reporter_user_id = v_user_id and feedback.created_at > statement_timestamp() - interval '1 hour') >= 10 then
    raise exception 'Feedback limit reached' using errcode = 'P0001';
  end if;

  insert into public.facility_feedback (reporter_user_id, facility_id, facility_name_snapshot, category, message)
  values (v_user_id, p_facility_id, v_facility_name, p_category, v_message)
  returning id into v_feedback_id;
  return v_feedback_id;
end;
$$;

create function public.admin_list_facility_feedback(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.current_user_is_admin() then raise exception 'Administrator role required' using errcode = '42501'; end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'Invalid pagination' using errcode = '22023'; end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', feedback.id, 'category', feedback.category,
      'facilityName', coalesce(facilities.name, feedback.facility_name_snapshot),
      'message', feedback.message, 'status', feedback.status,
      'createdAt', feedback.created_at, 'reporterUsername', profiles.anonymous_username
    ) order by feedback.created_at desc)
    from (
      select f.* from public.facility_feedback as f order by f.created_at desc limit p_limit offset p_offset
    ) as feedback
    left join public.facilities as facilities on facilities.id = feedback.facility_id
    left join public.profiles as profiles on profiles.id = feedback.reporter_user_id
  ), '[]'::jsonb);
end;
$$;

create function public.admin_set_facility_feedback_status(p_feedback_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.current_user_is_admin() then raise exception 'Administrator role required' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('new', 'reviewed', 'resolved') then raise exception 'Invalid feedback status' using errcode = '22023'; end if;
  update public.facility_feedback as feedback
  set status = p_status,
      reviewed_at = case when p_status = 'new' then null else coalesce(feedback.reviewed_at, statement_timestamp()) end,
      resolved_at = case when p_status = 'resolved' then statement_timestamp() else null end
  where feedback.id = p_feedback_id;
  if not found then raise exception 'Feedback not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.admin_delete_facility(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_facility(uuid) to authenticated;
revoke all on function public.post_facility_status(uuid, public.facility_status_type) from public, anon, authenticated;
grant execute on function public.post_facility_status(uuid, public.facility_status_type) to authenticated;
revoke all on function public.get_facility_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_facility_detail(uuid) to authenticated;
revoke all on function public.list_facilities(text, double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.list_facilities(text, double precision, double precision, double precision, double precision) to authenticated;
revoke all on function public.list_my_check_in_history(integer, integer) from public, anon, authenticated;
grant execute on function public.list_my_check_in_history(integer, integer) to authenticated;
revoke all on function public.get_my_play_time_summary() from public, anon, authenticated;
grant execute on function public.get_my_play_time_summary() to authenticated;
revoke all on function public.submit_facility_feedback(text, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_facility_feedback(text, uuid, text) to authenticated;
revoke all on function public.admin_list_facility_feedback(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_facility_feedback(integer, integer) to authenticated;
revoke all on function public.admin_set_facility_feedback_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_facility_feedback_status(uuid, text) to authenticated;

comment on table public.facility_feedback is 'Authenticated player feedback for facility information corrections and new facility suggestions; direct table access is denied.';
comment on function public.admin_delete_facility(uuid) is 'Administrators may permanently remove a facility while preserving player activity as de-identified history.';

commit;
