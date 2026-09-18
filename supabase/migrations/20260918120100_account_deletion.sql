begin;

-- The Auth identity owns the private profile and database role. Operational
-- history is retained but loses its stable account association.
alter table public.profiles
  drop constraint profiles_id_fkey,
  add constraint profiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade;

alter table public.user_roles
  drop constraint user_roles_user_id_fkey,
  add constraint user_roles_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.check_ins
  drop constraint check_ins_user_id_fkey,
  alter column user_id drop not null,
  add constraint check_ins_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete set null,
  add constraint check_ins_actor_required_while_open
    check (user_id is not null or checked_out_at is not null);

alter table public.facility_statuses
  drop constraint facility_statuses_author_user_id_fkey,
  alter column author_user_id drop not null,
  add constraint facility_statuses_author_user_id_fkey
    foreign key (author_user_id) references public.profiles (id) on delete set null,
  add constraint facility_statuses_author_required_while_unended
    check (author_user_id is not null or ended_at is not null);

-- Account deletion reaches the profile row before its BEFORE DELETE trigger
-- takes the per-user advisory lock. Player mutations therefore lock the live
-- profile first, then take that same advisory lock, before touching rows that
-- the deletion lifecycle closes. The profile FK lock also prevents deletion
-- from advancing to the trigger while a mutation can still create activity.
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

  perform 1
  from auth.users as users
  join public.profiles as profiles on profiles.id = users.id
  where users.id = v_user_id
    and users.phone is not null
    and users.phone_confirmed_at is not null
    and profiles.onboarding_completed_at is not null
  for key share of profiles;

  if not found then
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

  -- A live profile takes the profile lock. If deletion has already removed it,
  -- the existing no-open-check-in result below remains authoritative.
  perform 1
  from public.profiles as profiles
  where profiles.id = v_user_id
  for key share of profiles;

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
  v_status public.facility_statuses%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles as profiles
  where profiles.id = v_user_id
    and profiles.onboarding_completed_at is not null
  for key share of profiles;

  if not found then
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

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
    when 'courts_full' then interval '1 hour'
    when 'courts_wet_unsafe' then interval '2 hours'
    when 'maintenance' then interval '8 hours'
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

create function public.handle_profile_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  -- Serialize with check-in/check-out operations for this account. This uses
  -- the same lock key convention as the canonical check-in lifecycle.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(old.id::text, 0)
  );

  update public.check_ins as check_ins
  set
    checked_out_at = case
      when check_ins.expires_at <= v_now then check_ins.expires_at
      else v_now
    end,
    checkout_reason = case
      when check_ins.expires_at <= v_now
        then 'expired'::public.checkout_reason
      else 'account_deleted'::public.checkout_reason
    end
  where check_ins.user_id = old.id
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
      else 'account_deleted'::public.facility_status_end_reason
    end
  where statuses.author_user_id = old.id
    and statuses.ended_at is null;

  return old;
end;
$$;

create trigger profiles_handle_account_deletion
before delete on public.profiles
for each row execute function public.handle_profile_account_deletion();

-- A signed JWT may outlive its deleted Auth session. Player-facing reads that
-- otherwise expose shared CourtCheck data use this database-owned predicate.
create function public.current_user_has_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as profiles
      where profiles.id = (select auth.uid())
    );
$$;

-- Service-only defense for the destructive Edge Function. The JWT subject
-- and session identifier are verified before the Auth Admin API is invoked.
create function public.account_deletion_session_is_active(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions as sessions
    where sessions.id = p_session_id
      and sessions.user_id = p_user_id
  );
$$;

drop policy facilities_select_active_or_admin on public.facilities;
create policy facilities_select_active_or_admin
on public.facilities
for select
to authenticated
using (
  public.current_user_has_account()
  and (is_active or public.current_user_is_admin())
);

drop policy facility_activity_select_authenticated on public.facility_activity;
create policy facility_activity_select_authenticated
on public.facility_activity
for select
to authenticated
using (public.current_user_has_account());

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
  activity_state text,
  activity_reporter_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
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
  if not public.current_user_has_account() then
    raise exception 'Active account required' using errcode = '42501';
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
      when statuses.maintenance_reporter_count > 0 then 'maintenance'
      when statuses.wet_unsafe_reporter_count > 0 then 'courts_wet_unsafe'
      when statuses.tournament_reporter_count > 0 then 'tournament_at_courts'
      when statuses.full_reporter_count > 0 then 'courts_full'
      when activity.active_check_in_count > 0 then 'active'
      else 'quiet'
    end,
    case
      when statuses.closed_reporter_count > 0 then statuses.closed_reporter_count
      when statuses.maintenance_reporter_count > 0 then statuses.maintenance_reporter_count
      when statuses.wet_unsafe_reporter_count > 0 then statuses.wet_unsafe_reporter_count
      when statuses.tournament_reporter_count > 0 then statuses.tournament_reporter_count
      when statuses.full_reporter_count > 0 then statuses.full_reporter_count
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
        where statuses.status_type = 'maintenance'
      )::integer as maintenance_reporter_count,
      count(distinct statuses.author_user_id) filter (
        where statuses.status_type = 'courts_wet_unsafe'
      )::integer as wet_unsafe_reporter_count,
      count(distinct statuses.author_user_id) filter (
        where statuses.status_type = 'tournament_at_courts'
      )::integer as tournament_reporter_count,
      count(distinct statuses.author_user_id) filter (
        where statuses.status_type = 'courts_full'
      )::integer as full_reporter_count
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

revoke all on function public.handle_profile_account_deletion()
  from public, anon, authenticated, service_role;
revoke all on function public.current_user_has_account()
  from public, anon, authenticated, service_role;
revoke all on function public.account_deletion_session_is_active(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Policies and SECURITY DEFINER RPCs call this predicate; clients may ask only
-- whether their own auth.uid() still has a CourtCheck account.
grant execute on function public.current_user_has_account() to authenticated;
grant execute on function public.account_deletion_session_is_active(uuid, uuid)
  to service_role;

revoke all on function public.get_facility_detail(uuid)
  from public, anon, authenticated;
revoke all on function public.list_facilities(
  text,
  double precision,
  double precision,
  double precision,
  double precision
) from public, anon, authenticated;

grant execute on function public.get_facility_detail(uuid) to authenticated;
grant execute on function public.list_facilities(
  text,
  double precision,
  double precision,
  double precision,
  double precision
) to authenticated;

comment on function public.handle_profile_account_deletion() is
  'Closes current player activity before Auth-driven profile deletion; not client-callable.';
comment on function public.current_user_has_account() is
  'True only when auth.uid() still owns a live CourtCheck profile.';
comment on function public.account_deletion_session_is_active(uuid, uuid) is
  'Service-only current-session check used by the authenticated account-deletion Edge Function.';

commit;
