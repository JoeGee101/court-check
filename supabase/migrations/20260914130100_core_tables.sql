begin;

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  location extensions.geography(Point, 4326) not null,
  hours_text text not null,
  court_count integer not null,
  has_lights boolean not null default false,
  has_restrooms boolean not null default false,
  has_water boolean not null default false,
  is_active boolean not null default false,
  verified_by text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilities_name_not_blank check (char_length(btrim(name)) > 0),
  constraint facilities_address_not_blank check (char_length(btrim(address)) > 0),
  constraint facilities_hours_not_blank check (char_length(btrim(hours_text)) > 0),
  constraint facilities_court_count_nonnegative check (court_count >= 0)
);

create index facilities_location_gist
  on public.facilities using gist (location);
create index facilities_active_name
  on public.facilities (is_active, name);

create table public.facility_geofences (
  facility_id uuid primary key references public.facilities (id) on delete restrict,
  center extensions.geography(Point, 4326) not null,
  radius_m integer not null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_geofences_radius_range check (radius_m between 10 and 1000)
);

create index facility_geofences_center_gist
  on public.facility_geofences using gist (center);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  facility_id uuid not null references public.facilities (id) on delete restrict,
  checked_in_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 minutes'),
  checked_out_at timestamptz,
  checkout_reason public.checkout_reason,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_ins_expiry_after_entry check (expires_at > checked_in_at),
  constraint check_ins_fixed_expiry
    check (expires_at = checked_in_at + interval '90 minutes'),
  constraint check_ins_checkout_pair
    check ((checked_out_at is null) = (checkout_reason is null)),
  constraint check_ins_checkout_after_entry
    check (checked_out_at is null or checked_out_at >= checked_in_at)
);

create unique index check_ins_one_open_per_user
  on public.check_ins (user_id)
  where checked_out_at is null;
create index check_ins_facility_open_expiry
  on public.check_ins (facility_id, expires_at)
  where checked_out_at is null;
create index check_ins_user_history
  on public.check_ins (user_id, checked_in_at desc);

create table public.facility_statuses (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete restrict,
  author_user_id uuid not null references public.profiles (id) on delete restrict,
  status_type public.facility_status_type not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  end_reason public.facility_status_end_reason,
  constraint facility_statuses_fixed_expiry
    check (
      expires_at = created_at + case status_type
        when 'courts_closed' then interval '4 hours'
        when 'tournament_at_courts' then interval '8 hours'
      end
    ),
  constraint facility_statuses_end_pair
    check ((ended_at is null) = (end_reason is null)),
  constraint facility_statuses_end_after_creation
    check (ended_at is null or ended_at >= created_at)
);

create index facility_statuses_facility_open_expiry
  on public.facility_statuses (facility_id, expires_at)
  where ended_at is null;
create index facility_statuses_author_history
  on public.facility_statuses (author_user_id, created_at desc);

create table public.facility_activity (
  facility_id uuid primary key references public.facilities (id) on delete restrict,
  active_check_in_count integer not null default 0,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint facility_activity_count_nonnegative check (active_check_in_count >= 0)
);

alter table public.facilities enable row level security;
alter table public.facility_geofences enable row level security;
alter table public.check_ins enable row level security;
alter table public.facility_statuses enable row level security;
alter table public.facility_activity enable row level security;

revoke all on table public.facilities from anon, authenticated;
revoke all on table public.facility_geofences from anon, authenticated;
revoke all on table public.check_ins from anon, authenticated;
revoke all on table public.facility_statuses from anon, authenticated;
revoke all on table public.facility_activity from anon, authenticated;

create trigger facilities_set_updated_at
before update on public.facilities
for each row execute function public.set_updated_at();

create trigger facility_geofences_set_updated_at
before update on public.facility_geofences
for each row execute function public.set_updated_at();

create trigger check_ins_set_updated_at
before update on public.check_ins
for each row execute function public.set_updated_at();

commit;
