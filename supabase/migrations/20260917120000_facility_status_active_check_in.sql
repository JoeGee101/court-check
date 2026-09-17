begin;

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

  -- Keep the qualifying visit open through insertion. Checkout and expiry update
  -- this row, so their row locks serialize with this shared authorization lock.
  perform 1
  from public.check_ins as check_ins
  where check_ins.user_id = v_user_id
    and check_ins.facility_id = p_facility_id
    and check_ins.checked_out_at is null
    and check_ins.expires_at > v_now
  for share of check_ins;

  if not found then
    raise exception 'Active check-in at facility required' using errcode = '42501';
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

revoke all on function public.post_facility_status(
  uuid,
  public.facility_status_type
) from public, anon, authenticated;

grant execute on function public.post_facility_status(
  uuid,
  public.facility_status_type
) to authenticated;

commit;
