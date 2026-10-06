begin;

-- Facility detail aggregates a bounded monthly window across historical
-- check-ins, so keep that facility-scoped scan indexable.
create index check_ins_facility_history
  on public.check_ins (facility_id, checked_in_at)
  where user_id is not null;

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
  v_month_start := pg_catalog.date_trunc(
    'month',
    v_now at time zone 'America/Los_Angeles'
  ) at time zone 'America/Los_Angeles';
  v_month_key := pg_catalog.to_char(
    v_now at time zone 'America/Los_Angeles',
    'YYYY-MM'
  );

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
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
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
    'leaderboardMonth', v_month_key,
    'monthlyLeaderboard', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'rank', leaderboard.rank,
          'anonymousUsername', leaderboard.anonymous_username,
          'experienceLevel', leaderboard.experience_level,
          'totalSeconds', leaderboard.total_seconds
        )
        order by leaderboard.rank
      )
      from (
        select
          pg_catalog.row_number() over (
            order by player_totals.total_seconds desc, profiles.anonymous_username asc
          )::integer as rank,
          profiles.anonymous_username,
          profiles.experience_level,
          player_totals.total_seconds
        from (
          select
            check_ins.user_id,
            pg_catalog.floor(pg_catalog.sum(pg_catalog.date_part('epoch', (
              least(
                coalesce(check_ins.checked_out_at, v_now),
                check_ins.expires_at,
                v_now
              ) - greatest(check_ins.checked_in_at, v_month_start)
            ))))::bigint as total_seconds
          from public.check_ins as check_ins
          where check_ins.facility_id = facilities.id
            and check_ins.user_id is not null
            and check_ins.checked_in_at >= v_month_start - interval '90 minutes'
            and check_ins.checked_in_at < v_now
            and least(
              coalesce(check_ins.checked_out_at, v_now),
              check_ins.expires_at,
              v_now
            ) > greatest(check_ins.checked_in_at, v_month_start)
          group by check_ins.user_id
        ) as player_totals
        join public.profiles as profiles on profiles.id = player_totals.user_id
        where player_totals.total_seconds > 0
        order by player_totals.total_seconds desc, profiles.anonymous_username asc
        limit 10
      ) as leaderboard
    ), '[]'::jsonb),
    'statuses', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
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

revoke all on function public.get_facility_detail(uuid)
from public, anon, authenticated;
grant execute on function public.get_facility_detail(uuid) to authenticated;

commit;
