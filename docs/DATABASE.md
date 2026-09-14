# CourtCheck Database Design

## Purpose

This document specifies the planned PostgreSQL/PostGIS schema and security contract. All schema changes will eventually be implemented as ordered files in `supabase/migrations`; no database objects are created by this planning task.

The database owns identities, roles, geofence decisions, timestamps, expiry, and the one-open-check-in invariant. The mobile application is an untrusted public client.

## Conventions

- Primary keys are UUIDs unless a one-to-one row naturally uses its parent's UUID.
- All times are `timestamptz` and are assigned from database time.
- Mutable tables have `created_at` and `updated_at` maintained by database defaults/triggers.
- Foreign keys use restrictive deletion for historical records. Facilities and accounts are deactivated/retained rather than cascade-deleted.
- PostGIS is installed in one explicit extension schema and every function schema-qualifies spatial calls.
- RLS is enabled on every table in the exposed schema. Table grants are least-privilege in addition to RLS.
- Direct client mutation is denied when a canonical database function is specified.
- Every query, function, count, and projection that treats a check-in as active requires both `checked_out_at IS NULL` and `expires_at > now()`; Cron cleanup is never assumed to have happened already.

## Enumerated values

Use database enums or equivalent checked text domains for stable, closed sets:

| Type | Values |
| --- | --- |
| `app_role` | `user`, `admin` |
| `experience_level` | `newbie`, `beginner`, `intermediate`, `advanced`, `pro` |
| `checkout_reason` | `manual`, `expired`, `left_geofence`, `facility_deactivated` |
| `facility_status_type` | `courts_closed`, `tournament` |
| `facility_status_end_reason` | `expired`, `facility_deactivated`, `retracted` |

Labels such as “Newbie” and “Tournament at courts” are presentation strings mapped from these stable values in the app.

## Entities and relationships

```text
auth.users 1---1 profiles
auth.users 1---1 user_roles
profiles   1---* check_ins *---1 facilities
profiles   1---* facility_statuses *---1 facilities
facilities 1---1 facility_geofences
facilities 1---1 facility_activity
```

### `profiles`

Private application account data keyed to Supabase Auth.

| Column | Shape | Rules |
| --- | --- | --- |
| `id` | UUID PK/FK to `auth.users.id` | One profile per auth user |
| `anonymous_username` | text | Server-generated, non-null, immutable, unique case-insensitively |
| `experience_level` | enum, nullable | Required before onboarding completes |
| `email` | text, nullable | Optional contact data; never in player/public responses |
| `adult_confirmed_at` | timestamptz, nullable | Records the user's 18+ confirmation |
| `onboarding_completed_at` | timestamptz, nullable | Set only when required fields are valid |
| `created_at`, `updated_at` | timestamptz | Database-managed |

Phone number and phone-confirmation state remain in `auth.users`; they are not duplicated here. Other players never query `profiles` directly. Facility-detail functions return only anonymous username and experience for current players.

### `user_roles`

Database-owned authorization role, separated from self-editable account data.

| Column | Shape | Rules |
| --- | --- | --- |
| `user_id` | UUID PK/FK to `auth.users.id` | One role per user |
| `role` | `app_role` | Defaults to `user` in the auth-user trigger |
| `assigned_at` | timestamptz | Database-managed |
| `assigned_by` | UUID nullable | Trusted operator/admin audit reference |

There is no client insert/update policy. Initial admin assignment is a trusted dashboard/migration operation. A small `is_admin(user_id)` helper is used by policies and functions; ordinary clients cannot use it to change state.

### `facilities`

Player-safe facility data and the public marker/directions point.

| Column | Shape | Rules |
| --- | --- | --- |
| `id` | UUID PK | Database-generated |
| `name` | text | Required, trimmed |
| `address` | text | Required |
| `location` | `geography(Point, 4326)` | Required map/directions point |
| `hours_text` | text | Display value; supports “Sunrise – Sunset” without premature scheduling tables |
| `court_count` | integer | Nonnegative |
| `has_lights` | boolean | Required default false |
| `has_restrooms` | boolean | Required default false |
| `has_water` | boolean | Required default false |
| `is_active` | boolean | Controls player discovery and new check-ins |
| `verified_by` | text, nullable | Display authority, if verified |
| `created_by`, `updated_by` | UUID FK | Admin audit references |
| `created_at`, `updated_at` | timestamptz | Database-managed |

No hard delete is exposed. If a later requirement needs machine-computed opening hours, add a structured schedule in a migration rather than overloading `hours_text` now.

### `facility_geofences`

Admin-only one-to-one circular authorization boundary.

| Column | Shape | Rules |
| --- | --- | --- |
| `facility_id` | UUID PK/FK to `facilities.id` | One geofence per facility |
| `center` | `geography(Point, 4326)` | Required |
| `radius_m` | integer | Positive and within an approved operational maximum |
| `updated_by` | UUID FK | Admin audit reference |
| `created_at`, `updated_at` | timestamptz | Database-managed |

Use a GiST index on `center`. The separate table prevents ordinary facility reads from returning exact geofence settings. An active facility must have a valid geofence before it can accept check-ins; activation enforces that invariant.

### `check_ins`

Append-and-close check-in history. Rows are never deleted during normal product operation.

| Column | Shape | Rules |
| --- | --- | --- |
| `id` | UUID PK | Database-generated |
| `user_id` | UUID FK to `profiles.id` | Derived from `auth.uid()` |
| `facility_id` | UUID FK to `facilities.id` | Requested active facility |
| `checked_in_at` | timestamptz | Database-generated |
| `expires_at` | timestamptz | Database-generated as check-in time + 90 minutes |
| `checked_out_at` | timestamptz, nullable | Null while the row is open |
| `checkout_reason` | enum, nullable | Required when closed; null while open |
| `created_at`, `updated_at` | timestamptz | Database-managed |

Checks enforce:

- `expires_at > checked_in_at`;
- checkout time and reason are either both null or both present;
- a closed time cannot precede check-in;
- the canonical functions are the only client mutation path.

Indexes:

- unique partial index on `user_id WHERE checked_out_at IS NULL`;
- index on `(facility_id, expires_at) WHERE checked_out_at IS NULL`;
- index on `(user_id, checked_in_at DESC)` for profile history.

“Active” means `checked_out_at IS NULL AND expires_at > now()`. The unique index deliberately uses only the stable null predicate; canonical functions close due open rows before insertion.

The raw device coordinate used to validate entry is not retained in the MVP. This avoids accumulating sensitive location history that the product does not need.

### `facility_statuses`

Preset status history.

| Column | Shape | Rules |
| --- | --- | --- |
| `id` | UUID PK | Database-generated |
| `facility_id` | UUID FK | Target facility |
| `author_user_id` | UUID FK to `profiles.id` | Derived from `auth.uid()` |
| `status_type` | enum | Preset values only |
| `created_at` | timestamptz | Database-generated |
| `expires_at` | timestamptz | Server-generated: four hours after creation for `courts_closed`; eight hours for `tournament` |
| `ended_at` | timestamptz, nullable | Set on expiry/deactivation/retraction |
| `end_reason` | enum, nullable | Paired with `ended_at` |

An active status is not ended and has `expires_at > now()`. The database derives the expiry from `status_type`; the client cannot submit or extend it. Index `(facility_id, expires_at) WHERE ended_at IS NULL`. Raw rows are not the player-facing read contract because they contain stable author IDs; the facility-detail function returns status type, times, and the author's anonymous username.

### `facility_activity`

A safe one-to-one Realtime projection, not a source of authorization truth.

| Column | Shape | Rules |
| --- | --- | --- |
| `facility_id` | UUID PK/FK | One row per facility |
| `active_check_in_count` | integer | Trigger/function-maintained, nonnegative |
| `revision` | bigint | Increments for relevant facility/check-in/status changes |
| `updated_at` | timestamptz | Database-managed |

Only this table enters the MVP Realtime Postgres Changes publication. It contains no user IDs, account data, check-in IDs, status authors, or geofence data. Clients use an event as an invalidation signal and refetch canonical reads.

Count maintenance recomputes the affected facility's count from authoritative check-ins satisfying `checked_out_at IS NULL AND expires_at > now()` instead of applying fragile `+1/-1` arithmetic. It must not count an expired-but-not-yet-closed row. Expiry processing, manual checkout, check-in, status change, and facility edits bump `revision` transactionally. A reconciliation function can rebuild projection rows after migrations or operational repair.

## PostGIS representation and validation

Both facility marker and geofence center use WGS84 geography points. Database construction follows:

```text
ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
```

Longitude is first. RPC inputs validate longitude from -180 through 180 and latitude from -90 through 90 before construction.

Authoritative entry validation is conceptually:

```text
ST_DWithin(submitted_device_point, facility_geofence.center, radius_m)
```

Using `geography` makes the radius and distance meters. The client may render a circle or calculate a preview distance, but only the function result authorizes entry. The function rejects inactive facilities and missing/invalid geofences before the spatial test.

## Canonical database functions

Names are descriptive and may be adjusted consistently in migrations/types. Their responsibilities are fixed.

### Account reads and writes

- `handle_new_auth_user` (trigger): create profile, collision-safe anonymous username, and default role.
- `get_my_account`: return only the caller's safe account/onboarding/role payload.
- `complete_onboarding(email, adult_confirmed, experience)`: require confirmed phone auth, require adult confirmation and valid experience, normalize optional email, and set completion time atomically.
- `update_my_profile(email, experience)`: update only allowed self-service fields; cannot change role, username, age confirmation, or completion state.

Supabase Auth uses phone OTP only. Production SMS delivery is configured through Twilio; passwords and email-based login identities are outside the production flow. Development uses Supabase test OTP/test-number support wherever possible.

### Player reads

- `list_facilities(search?, map_bounds?)`: return active facility display fields, latitude/longitude, count, and derived activity state. Every count uses `checked_out_at IS NULL AND expires_at > now()`. Search and bounds are optional so Boards and Map share one contract.
- `get_facility_detail(facility_id)`: return safe facility fields, active count, anonymous current-player summaries, and nonexpired preset statuses. Active check-ins require `checked_out_at IS NULL AND expires_at > now()`. It never returns stable user IDs, emails, phone numbers, or geofence settings.
- `list_my_check_in_history(page)`: return only the caller's history with bounded pagination.

### Check-in writes

- `check_in(facility_id, latitude, longitude)`: the only entry path.
- `check_out()`: close only the caller's open row; no client-provided row/user/reason/time.

`check_in` runs in one transaction and obtains a transaction-level lock scoped to the authenticated user. It closes a due open row, verifies account/facility/geofence, runs `ST_DWithin`, inserts a 90-minute row, and lets the uniqueness constraint provide a final concurrency backstop.

### Status writes

- `post_facility_status(facility_id, status_type)`: verify an onboarded authenticated author and active facility, then set `expires_at` from database time to four hours for `courts_closed` or eight hours for `tournament`. It never accepts a client-provided expiry.
- `retract_my_facility_status(status_id)`: optional only if product approves retraction; author-only and records rather than deletes.

### Admin writes

- `admin_save_facility(...)`: check role, validate ordinary fields/coordinates, construct marker/geofence PostGIS values, and insert/update transactionally.
- `admin_set_facility_active(facility_id, active)`: check role; activation requires a complete valid geofence. Deactivation closes open check-ins as `facility_deactivated`, ends active statuses, and preserves all rows.

Admin table RLS remains enabled even when the UI primarily uses these functions.

### Maintenance

- `expire_due_records()`: close due check-ins at their exact `expires_at`, end due statuses, and update the activity projection.
- `rebuild_facility_activity(facility_id?)`: trusted repair/test utility to recompute counts and revisions.

Supabase Cron may call `expire_due_records()` every minute. Cron closes and annotates due rows for history, releases the open-row uniqueness slot, and drives Realtime invalidations. Every query and projection that determines current activity still applies `checked_out_at IS NULL AND expires_at > now()`, so the job interval affects cleanup/event timing, not validity. No caller may treat `checked_out_at IS NULL` alone as active.

## RLS and grants strategy

RLS is defense in depth with explicit grants. “Via function” means direct table mutation is revoked/denied and the function performs its own checks.

| Object | Unauthenticated | Authenticated user | Admin |
| --- | --- | --- | --- |
| `profiles` | none | select own; writes via account functions | select all; no arbitrary role change |
| `user_roles` | none | own role via `get_my_account` only | select; assignment remains trusted-only initially |
| `facilities` | none | select active player-safe rows/RPC | select all; mutate via admin policy/function |
| `facility_geofences` | none | none | select/mutate through admin checks |
| `check_ins` | none | select own history; check-in/out via functions | select all; no destructive delete |
| `facility_statuses` | none | select own rows; player display via safe detail function; mutate via functions | select all; controlled mutation |
| `facility_activity` | none | select | select |

Additional rules:

- A user cannot insert a profile/role for another auth ID.
- A user cannot update their role or anonymous username.
- A normal user cannot insert/update/deactivate a facility or change a geofence, even with a handcrafted API call.
- Direct insert/update/delete on `check_ins` is unavailable to the mobile roles.
- Direct status writes are unavailable, preventing client-selected author/time/type/expiry.
- No table grants or policies are added for the `anon` role in the first authenticated-only product phase.
- The mobile app uses only a publishable key. A secret/service-role key never ships to a device because it bypasses RLS.

Every policy and function receives negative tests using a normal user's JWT. UI route guards are never considered an authorization test.

## Realtime behavior

Add only `facility_activity` to the `supabase_realtime` publication for the MVP. Its RLS permits authenticated reads, including rows for inactive facilities, because the payload is limited to facility UUID/count/revision. Keeping the row readable across activation changes ensures clients receive the invalidation and can remove a newly inactive facility after refetch.

Raw check-in/status tables remain private and outside the publication. This prevents Realtime payloads from disclosing stable account identifiers or historical movement/activity records. A detail screen that receives a revision event calls `get_facility_detail` again.

On socket reconnect and application foreground, refetch rather than assuming every database event was delivered.

## Expiry and history guarantees

- No timer on a phone changes authoritative state.
- `expires_at` is set only from database time.
- Every current-state query, count, RPC, and projection excludes due rows with the complete predicate `checked_out_at IS NULL AND expires_at > now()` even before maintenance updates them.
- The application never depends solely on Cron having processed an expired row.
- Cron closes check-ins at the logical expiry timestamp, not at the later job-run timestamp.
- Closing updates a row; it never deletes history.
- A manual checkout after logical expiry is recorded as `expired`, not `manual`.
- Deactivating a facility closes sessions with a distinct reason.
- The open-row unique index guarantees at most one not-yet-closed check-in per user across all facilities and devices.

## Later background-location additions

Do not add these in the initial migration. When background checkout is implemented, add:

- nullable `check_ins.outside_since` set only from database time;
- a `report_check_in_location(check_in_id, latitude, longitude)` function that verifies caller ownership and PostGIS inside/outside state;
- maintenance logic that closes rows as `left_geofence` after 15 uninterrupted minutes outside;
- inside reports that clear `outside_since` before the grace period completes.

Do not retain a stream of raw coordinates unless a later, explicitly reviewed product/legal requirement needs it. The original 90-minute `expires_at` remains an unconditional upper bound.

## Migration order

When implementation is authorized, prefer small reversible migrations in this order:

1. extensions, enums/domains, timestamp helpers;
2. profiles, roles, auth-user trigger, admin helper;
3. facilities and facility geofences;
4. check-ins and constraints/indexes;
5. facility statuses;
6. facility activity projection and maintenance triggers;
7. canonical read/write functions and grants;
8. RLS policies;
9. Realtime publication configuration;
10. expiry Cron job;
11. development seed facilities (separate from production data).

Generate TypeScript database types only after migrations apply successfully.

## Required database tests

At minimum, automated SQL/integration tests cover:

- auth trigger creates exactly one profile/role and a unique anonymous username;
- incomplete onboarding cannot check in;
- normal users cannot write facilities/geofences or promote themselves;
- admins can manage facilities, and activation requires a geofence;
- longitude/latitude/radius constraints reject invalid values;
- inside check-in succeeds and outside/inactive/missing-geofence check-in fails;
- two concurrent attempts leave exactly one open row;
- the same user cannot be open at two facilities;
- another user cannot check out the caller or read private history;
- manual checkout and expiry preserve correct timestamps/reasons;
- due rows never appear in any current query, count, or projection before the Cron sweep;
- status types and fixed four-hour/eight-hour server expiry rules cannot be bypassed;
- player RPCs and Realtime rows contain no private identifiers/geofence data;
- projection counts match authoritative open, nonexpired rows after every transition.

## Finalized product decisions

- Authentication is phone OTP-only, with no production password flow.
- Twilio provides production SMS through Supabase Auth.
- Development uses Supabase test OTP/test-number capabilities wherever possible.
- `courts_closed` expires after four hours and `tournament` after eight hours; the database assigns both expiries.
- Cron may close expired rows, but active state always independently requires `expires_at > now()`.
