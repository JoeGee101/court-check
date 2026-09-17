begin;

create function public.get_my_active_check_in()
returns table (
  facility_id uuid,
  facility_name text,
  checked_in_at timestamptz,
  expires_at timestamptz,
  server_time timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_server_time timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    check_ins.facility_id,
    facilities.name,
    check_ins.checked_in_at,
    check_ins.expires_at,
    v_server_time
  from public.check_ins as check_ins
  join public.facilities as facilities
    on facilities.id = check_ins.facility_id
  where check_ins.user_id = v_user_id
    and check_ins.checked_out_at is null
    and check_ins.expires_at > now()
  order by check_ins.checked_in_at desc
  limit 1;
end;
$$;

revoke all on function public.get_my_active_check_in()
from public, anon, authenticated, service_role;
grant execute on function public.get_my_active_check_in() to authenticated;

comment on function public.get_my_active_check_in() is
  'Returns only the authenticated caller''s current server-time-active check-in and safe facility display data.';

commit;
