-- Development-only prototype data. Coordinates and operating details must be
-- verified by an administrator before production use.

insert into public.facilities (
  id,
  name,
  address,
  court_count,
  hours_text,
  has_lights,
  has_restrooms,
  has_water,
  is_active,
  verified_by,
  location
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Desert Breeze Park',
    '8275 W Spring Mountain Rd, Las Vegas, NV 89117',
    8,
    '6:00 AM - 10:00 PM',
    true,
    true,
    true,
    true,
    'Clark County Parks & Recreation',
    extensions.st_setsrid(extensions.st_makepoint(-115.276645, 36.124921), 4326)::extensions.geography
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Sunset Park Pickleball Complex',
    '2601 E Sunset Rd, Las Vegas, NV 89120',
    6,
    '5:30 AM - 11:00 PM',
    true,
    true,
    false,
    true,
    'Clark County Parks & Recreation',
    extensions.st_setsrid(extensions.st_makepoint(-115.113947, 36.065702), 4326)::extensions.geography
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Molasky Family Park',
    '1065 E Twain Ave, Las Vegas, NV 89169',
    4,
    'Sunrise - Sunset',
    false,
    false,
    true,
    true,
    'Clark County Parks & Recreation',
    extensions.st_setsrid(extensions.st_makepoint(-115.140600, 36.121200), 4326)::extensions.geography
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Kellogg Zaher Sports Complex',
    '8100 W Positano Way, Las Vegas, NV',
    12,
    '6:00 AM - 10:00 PM',
    true,
    true,
    true,
    true,
    'City of Las Vegas',
    extensions.st_setsrid(extensions.st_makepoint(-115.271000, 36.178200), 4326)::extensions.geography
  )
on conflict (id) do update
set
  name = excluded.name,
  address = excluded.address,
  court_count = excluded.court_count,
  hours_text = excluded.hours_text,
  has_lights = excluded.has_lights,
  has_restrooms = excluded.has_restrooms,
  has_water = excluded.has_water,
  is_active = excluded.is_active,
  verified_by = excluded.verified_by,
  location = excluded.location,
  updated_at = now();

insert into public.facility_geofences (
  facility_id,
  center,
  radius_m
)
select
  facilities.id,
  facilities.location,
  150
from public.facilities
where facilities.id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
)
on conflict (facility_id) do update
set
  center = excluded.center,
  radius_m = excluded.radius_m,
  updated_at = now();
