begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create type public.app_role as enum ('user', 'admin');
create type public.experience_level as enum (
  'newbie',
  'beginner',
  'intermediate',
  'advanced',
  'pro'
);
create type public.checkout_reason as enum (
  'manual',
  'expired',
  'left_geofence',
  'facility_deactivated'
);
create type public.facility_status_type as enum (
  'courts_closed',
  'tournament_at_courts'
);
create type public.facility_status_end_reason as enum (
  'expired',
  'facility_deactivated',
  'retracted'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  anonymous_username text not null,
  experience_level public.experience_level,
  email text,
  adult_confirmed_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_not_blank
    check (char_length(btrim(anonymous_username)) > 0),
  constraint profiles_email_length
    check (email is null or char_length(email) <= 320),
  constraint profiles_onboarding_complete
    check (
      onboarding_completed_at is null
      or (adult_confirmed_at is not null and experience_level is not null)
    )
);

create unique index profiles_anonymous_username_unique
  on public.profiles (lower(anonymous_username));

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete restrict,
  role public.app_role not null default 'user',
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.prevent_anonymous_username_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.anonymous_username is distinct from old.anonymous_username then
    raise exception 'Anonymous username is immutable' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger profiles_keep_anonymous_username
before update of anonymous_username on public.profiles
for each row execute function public.prevent_anonymous_username_change();

create or replace function public.generate_anonymous_username()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_adjectives constant text[] := array[
    'Swift', 'Bright', 'Clever', 'Happy', 'Lucky',
    'Mighty', 'Quick', 'Rally', 'Sunny', 'Zippy'
  ];
  v_nouns constant text[] := array[
    'Paddle', 'Dink', 'Volley', 'Rally', 'Kitchen',
    'Falcon', 'Gecko', 'Otter', 'Roadrunner', 'Hawk'
  ];
begin
  return
    v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::integer]
    || v_nouns[1 + floor(random() * array_length(v_nouns, 1))::integer]
    || lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;

    begin
      insert into public.profiles (id, anonymous_username)
      values (new.id, public.generate_anonymous_username());
      exit;
    exception
      when unique_violation then
        if v_attempt >= 20 then
          raise exception 'Unable to generate a unique anonymous username';
        end if;
    end;
  end loop;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

do $$
declare
  v_user record;
  v_attempt integer;
begin
  for v_user in
    select users.id
    from auth.users as users
    where not exists (
      select 1 from public.profiles as profiles where profiles.id = users.id
    )
  loop
    v_attempt := 0;

    loop
      v_attempt := v_attempt + 1;

      begin
        insert into public.profiles (id, anonymous_username)
        values (v_user.id, public.generate_anonymous_username());
        exit;
      exception
        when unique_violation then
          if v_attempt >= 20 then
            raise exception 'Unable to generate a unique anonymous username';
          end if;
      end;
    end loop;

    insert into public.user_roles (user_id, role)
    values (v_user.id, 'user')
    on conflict (user_id) do nothing;
  end loop;
end;
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as roles
    where roles.user_id = (select auth.uid())
      and roles.role = 'admin'
  );
$$;

create or replace function public.get_my_account()
returns table (
  id uuid,
  anonymous_username text,
  experience_level public.experience_level,
  email text,
  adult_confirmed_at timestamptz,
  onboarding_completed_at timestamptz,
  role public.app_role,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    profiles.id,
    profiles.anonymous_username,
    profiles.experience_level,
    profiles.email,
    profiles.adult_confirmed_at,
    profiles.onboarding_completed_at,
    roles.role,
    profiles.created_at,
    profiles.updated_at
  from public.profiles as profiles
  join public.user_roles as roles on roles.user_id = profiles.id
  where profiles.id = (select auth.uid());
end;
$$;

create or replace function public.complete_onboarding(
  p_email text,
  p_adult_confirmed boolean,
  p_experience public.experience_level
)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := nullif(btrim(p_email), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from auth.users as users
    where users.id = v_user_id
      and users.phone is not null
      and users.phone_confirmed_at is not null
  ) then
    raise exception 'A verified phone number is required' using errcode = '42501';
  end if;

  if p_adult_confirmed is not true then
    raise exception 'Adult confirmation is required' using errcode = '22023';
  end if;

  if p_experience is null then
    raise exception 'Experience level is required' using errcode = '22023';
  end if;

  if v_email is not null and char_length(v_email) > 320 then
    raise exception 'Email is too long' using errcode = '22023';
  end if;

  return query
  update public.profiles as profiles
  set
    email = v_email,
    experience_level = p_experience,
    adult_confirmed_at = coalesce(profiles.adult_confirmed_at, statement_timestamp()),
    onboarding_completed_at = coalesce(
      profiles.onboarding_completed_at,
      statement_timestamp()
    )
  where profiles.id = v_user_id
  returning profiles.*;
end;
$$;

create or replace function public.update_my_profile(
  p_email text,
  p_experience public.experience_level
)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := nullif(btrim(p_email), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_experience is null then
    raise exception 'Experience level is required' using errcode = '22023';
  end if;

  if v_email is not null and char_length(v_email) > 320 then
    raise exception 'Email is too long' using errcode = '22023';
  end if;

  return query
  update public.profiles as profiles
  set email = v_email, experience_level = p_experience
  where profiles.id = v_user_id
    and profiles.onboarding_completed_at is not null
  returning profiles.*;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_anonymous_username_change() from public, anon, authenticated;
revoke all on function public.generate_anonymous_username() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.current_user_is_admin() from public, anon, authenticated;
revoke all on function public.get_my_account() from public, anon, authenticated;
revoke all on function public.complete_onboarding(text, boolean, public.experience_level) from public, anon, authenticated;
revoke all on function public.update_my_profile(text, public.experience_level) from public, anon, authenticated;

commit;
