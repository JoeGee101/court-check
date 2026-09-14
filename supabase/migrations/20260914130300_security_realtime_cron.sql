begin;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.facilities enable row level security;
alter table public.facility_geofences enable row level security;
alter table public.check_ins enable row level security;
alter table public.facility_statuses enable row level security;
alter table public.facility_activity enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_select_admin
on public.profiles
for select
to authenticated
using ((select public.current_user_is_admin()));

create policy user_roles_select_admin
on public.user_roles
for select
to authenticated
using ((select public.current_user_is_admin()));

create policy facilities_select_active_or_admin
on public.facilities
for select
to authenticated
using (is_active or (select public.current_user_is_admin()));

create policy facility_geofences_select_admin
on public.facility_geofences
for select
to authenticated
using ((select public.current_user_is_admin()));

create policy check_ins_select_own_or_admin
on public.check_ins
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
);

create policy facility_statuses_select_own_or_admin
on public.facility_statuses
for select
to authenticated
using (
  author_user_id = (select auth.uid())
  or (select public.current_user_is_admin())
);

create policy facility_activity_select_authenticated
on public.facility_activity
for select
to authenticated
using (true);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.facilities from anon, authenticated;
revoke all on table public.facility_geofences from anon, authenticated;
revoke all on table public.check_ins from anon, authenticated;
revoke all on table public.facility_statuses from anon, authenticated;
revoke all on table public.facility_activity from anon, authenticated;

grant usage on schema public to authenticated;
grant usage on schema extensions to authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.user_roles to authenticated;
grant select (
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
  created_at,
  updated_at
) on table public.facilities to authenticated;
grant select on table public.facility_geofences to authenticated;
grant select on table public.check_ins to authenticated;
grant select on table public.facility_statuses to authenticated;
grant select on table public.facility_activity to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_anonymous_username_change() from public, anon, authenticated;
revoke all on function public.generate_anonymous_username() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.refresh_facility_activity(uuid) from public, anon, authenticated;
revoke all on function public.handle_facility_activity_change() from public, anon, authenticated;
revoke all on function public.handle_facility_change() from public, anon, authenticated;
revoke all on function public.rebuild_facility_activity(uuid) from public, anon, authenticated;
revoke all on function public.expire_due_records() from public, anon, authenticated;

revoke all on function public.current_user_is_admin() from public, anon, authenticated;
revoke all on function public.get_my_account() from public, anon, authenticated;
revoke all on function public.complete_onboarding(text, boolean, public.experience_level) from public, anon, authenticated;
revoke all on function public.update_my_profile(text, public.experience_level) from public, anon, authenticated;
revoke all on function public.list_facilities(text, double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.get_facility_detail(uuid) from public, anon, authenticated;
revoke all on function public.list_my_check_in_history(integer, integer) from public, anon, authenticated;
revoke all on function public.check_in(uuid, double precision, double precision) from public, anon, authenticated;
revoke all on function public.check_out() from public, anon, authenticated;
revoke all on function public.post_facility_status(uuid, public.facility_status_type) from public, anon, authenticated;
revoke all on function public.admin_save_facility(uuid, text, text, double precision, double precision, text, integer, boolean, boolean, boolean, boolean, text, double precision, double precision, integer) from public, anon, authenticated;
revoke all on function public.admin_set_facility_active(uuid, boolean) from public, anon, authenticated;

grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.get_my_account() to authenticated;
grant execute on function public.complete_onboarding(text, boolean, public.experience_level) to authenticated;
grant execute on function public.update_my_profile(text, public.experience_level) to authenticated;
grant execute on function public.list_facilities(text, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.get_facility_detail(uuid) to authenticated;
grant execute on function public.list_my_check_in_history(integer, integer) to authenticated;
grant execute on function public.check_in(uuid, double precision, double precision) to authenticated;
grant execute on function public.check_out() to authenticated;
grant execute on function public.post_facility_status(uuid, public.facility_status_type) to authenticated;
grant execute on function public.admin_save_facility(uuid, text, text, double precision, double precision, text, integer, boolean, boolean, boolean, boolean, text, double precision, double precision, integer) to authenticated;
grant execute on function public.admin_set_facility_active(uuid, boolean) to authenticated;

grant execute on function public.rebuild_facility_activity(uuid) to service_role;
grant execute on function public.expire_due_records() to service_role;

do $$
declare
  v_table_name text;
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
      and puballtables
  ) then
    raise exception
      'supabase_realtime must use an explicit table list before CourtCheck migrations can continue';
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach v_table_name in array array[
      'profiles',
      'user_roles',
      'facilities',
      'facility_geofences',
      'check_ins',
      'facility_statuses'
    ]
    loop
      if exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table_name
      ) then
        execute format(
          'alter publication supabase_realtime drop table public.%I',
          v_table_name
        );
      end if;
    end loop;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'facility_activity'
    ) then
      alter publication supabase_realtime add table public.facility_activity;
    end if;
  end if;
end;
$$;

create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'courtcheck-expire-due-records'
  ) then
    perform cron.schedule(
      'courtcheck-expire-due-records',
      '* * * * *',
      'select public.expire_due_records();'
    );
  end if;
end;
$$;

comment on policy facility_activity_select_authenticated on public.facility_activity is
  'Realtime-safe projection: facility identifier and aggregate state only; no user identifiers.';

commit;
