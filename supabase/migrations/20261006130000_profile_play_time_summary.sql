begin;

create function public.get_my_play_time_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_now timestamptz := statement_timestamp();
  v_week_start timestamptz;
  v_weekly_seconds bigint;
  v_recent_sessions jsonb;
begin
  if v_user_id is null or not public.current_user_has_account() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  v_week_start := v_now - interval '7 days';

  select floor(coalesce(
    sum(extract(epoch from (
      least(
        coalesce(check_ins.checked_out_at, v_now),
        check_ins.expires_at,
        v_now
      ) - greatest(check_ins.checked_in_at, v_week_start)
    ))),
    0
  ))::bigint
  into v_weekly_seconds
  from public.check_ins as check_ins
  where check_ins.user_id = v_user_id
    and check_ins.checked_in_at < v_now
    and least(
      coalesce(check_ins.checked_out_at, v_now),
      check_ins.expires_at,
      v_now
    ) > v_week_start;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'facilityName', recent_sessions.facility_name,
        'checkedInAt', recent_sessions.checked_in_at,
        'durationSeconds', recent_sessions.duration_seconds,
        'isActive', recent_sessions.is_active
      ) order by recent_sessions.checked_in_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_sessions
  from (
    select
      facilities.name as facility_name,
      check_ins.checked_in_at,
      floor(extract(epoch from (
        least(
          coalesce(check_ins.checked_out_at, v_now),
          check_ins.expires_at,
          v_now
        ) - check_ins.checked_in_at
      )))::bigint as duration_seconds,
      check_ins.checked_out_at is null and check_ins.expires_at > v_now as is_active
    from public.check_ins as check_ins
    join public.facilities as facilities on facilities.id = check_ins.facility_id
    where check_ins.user_id = v_user_id
      and check_ins.checked_in_at < v_now
    order by check_ins.checked_in_at desc
    limit 3
  ) as recent_sessions;

  return pg_catalog.jsonb_build_object(
    'weeklySeconds', coalesce(v_weekly_seconds, 0),
    'recentSessions', v_recent_sessions
  );
end;
$$;

revoke all on function public.get_my_play_time_summary()
from public, anon, authenticated;
grant execute on function public.get_my_play_time_summary()
to authenticated;

commit;
