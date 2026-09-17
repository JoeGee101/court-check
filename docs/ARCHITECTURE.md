# CourtCheck Application Architecture

## Status and scope

This document defines the target architecture for CourtCheck. It is a planning document, not an implementation record.

CourtCheck is one Expo mobile application with two authenticated experiences:

- the player experience;
- the administrator experience.

The application talks directly to Supabase Auth, PostgreSQL/PostGIS, and Supabase Realtime through the Supabase client. PostgreSQL functions and RLS are the security boundary. No separate API server, admin web application, Firebase project, Redux store, or offline synchronization layer is needed for the MVP.

The current repository is still the Expo starter scaffold. Its source is already under `src/`, strict TypeScript is enabled, and the future structure below can be introduced incrementally when implementation begins. `@supabase/supabase-js`, `expo-location`, and `react-native-maps` are not yet present in `package.json`; they should be added only in the implementation phase that uses them. This architecture does not require restructuring or installing anything now.

## 1. Recommended `src/` structure

```text
src/
  app/                         # Expo Router files; screens stay thin
    _layout.tsx                # providers, session bootstrap, root stack
    index.tsx                  # state-aware entry redirect
    (auth)/
      _layout.tsx
      welcome.tsx
      phone.tsx
      verify.tsx
    onboarding/
      _layout.tsx
      account.tsx
      experience.tsx
    player/
      _layout.tsx              # accepts both user and admin roles
      (tabs)/
        _layout.tsx
        boards.tsx
        map.tsx
        profile.tsx
        facilities/
          [facilityId].tsx     # hidden tab route; tab bar remains visible
    admin/
      _layout.tsx              # admin-only route guard and stack
      index.tsx
      facilities/
        index.tsx
        new.tsx
        [facilityId]/
          index.tsx
          geofence.tsx
  components/
    ui/                        # small reusable primitives only
  features/
    auth/                      # session provider, OTP operations
    onboarding/                # account completion operations and UI
    facilities/                # board, map, detail queries/components
    check-ins/                 # check-in/out orchestration
    statuses/                  # preset status operations
    admin-facilities/          # admin forms and map editor
  hooks/                       # truly cross-feature hooks only
  lib/
    supabase/
      client.ts
      database.types.ts        # generated from the database schema
    location.ts                # foreground location adapter
    maps.ts                    # external directions adapter
  constants/
    theme.ts
  types/                       # app-only shared types; not DB duplicates
```

Guidelines:

- Route files compose feature modules and handle navigation; business/database logic belongs in `features/` or `lib/`.
- Keep code with one feature until it is genuinely shared. Do not add repository/service layers merely to wrap one Supabase call.
- Use one `SessionProvider` for authentication/account bootstrap. Use local component state and focused hooks for server data; do not add a global state library for the MVP.
- Generate database types from Supabase rather than maintaining hand-written copies of table/RPC types.
- Recreate `docs/prototype.html` with native components. Do not embed or translate its HTML/CSS into the app.

## 2. Expo Router structure and navigation

The root decides among four states after the persisted Supabase session and the current account record have loaded:

| State | Destination |
| --- | --- |
| No authenticated session | `/(auth)/welcome` |
| Authenticated, onboarding incomplete | `/onboarding/account` or the first incomplete step |
| Complete account with `role=user` | `/player/boards` |
| Complete account with `role=admin` | `/admin` |

The root must render a loading/splash state until both checks finish. It must not briefly render a protected screen and then redirect.

The player tab layout uses Expo Router's stable tabs and contains Boards, Map, and Profile, matching the prototype. The starter's unstable native-tab example is not an architectural dependency. Facility detail is a hidden route inside the player tab group so the tab bar may remain visible. If the selected tab implementation makes hidden dynamic routes brittle, facility detail may instead be a stack screen above the tabs; this is a presentation tradeoff, not a security boundary.

The admin layout is a stack inside the same native app. It starts with a facility list/dashboard and routes to create, edit, and geofence screens. An explicit **Open player view** action navigates an admin to `/player/boards`. The player layout accepts both roles. An admin-only control in Profile returns the admin to `/admin`.

Normal users who manually navigate to `/admin` are redirected to `/player/boards`. Signed-out users who reach any protected route are redirected to authentication. These route guards are for navigation and user experience only; database authorization remains authoritative.

## 3. Authentication and onboarding

Use Supabase phone OTP authentication:

1. User enters an E.164 phone number.
2. The app calls Supabase Auth to send an SMS OTP.
3. User enters the six-digit code and Supabase verifies it.
4. A database trigger creates the user's private profile, a default `user` role row, and a collision-safe anonymous username.
5. The authenticated but incomplete user supplies optional email, confirms they are 18+, and selects an experience level.
6. One database function validates and records onboarding completion.
7. The root routes the completed account by its database role.

Production authentication is passwordless and OTP-only on every sign-in. The password field in the prototype is non-normative and must not be included in the planned production flow. Optional email is contact/profile data, not a second login identity in phase one; adding password, email login, or email verification would be separate future scope.

Twilio is the production SMS provider configured through Supabase Auth. Development should use Supabase test OTP/test-number capabilities wherever possible; real Twilio delivery is reserved for integration checks that specifically need the production-like SMS path.

The phone number stays in Supabase Auth and is not copied into player-readable tables. Anonymous username generation occurs in PostgreSQL, is unique case-insensitively, and is immutable in the MVP. The client never chooses a role or username.

Session changes are handled through the Supabase auth-state listener. On cold start, token refresh, sign-out, or app foregrounding, refetch the current account record and let the root gate choose the valid route.

## 4. Role-based routing and authorization

Store roles in a database-owned `user_roles` table, not editable user metadata. New accounts receive `user`. Initial admins are promoted through a trusted Supabase dashboard/SQL operation; there is no client-facing role promotion flow.

The app fetches its role through a narrow `get_my_account` database function and uses it to select navigation. Every admin table policy or admin function independently checks `auth.uid()` against `user_roles`. This avoids relying on a stale custom JWT claim and keeps the small initial role model understandable.

Client checks may hide controls and redirect routes, but cannot grant access. RLS and explicit checks inside security-definer functions must reject a normal user even if they call the Supabase API directly.

## 5. Data ownership and server contracts

The database model is specified in `docs/DATABASE.md`. The principal entities are:

- private profiles and database-owned roles;
- facilities and separate admin-only circular geofences;
- immutable-history check-ins;
- preset, expiring facility statuses;
- a safe per-facility activity projection for Realtime.

Use ordinary RLS-protected reads where the full row is safe. Use narrowly scoped PostgreSQL functions for operations requiring validation, multi-row atomicity, private joins, or a privacy-safe response. In particular, check-in/out, onboarding completion, status posting, facility detail, and geofence saves are database functions.

Security-definer functions must set an empty/fixed `search_path`, schema-qualify referenced objects, validate `auth.uid()` and role/onboarding state explicitly, and have execution revoked from `public` before granting only the intended Postgres roles.

## 6. Facility and geofence architecture

Each facility has a public map/directions point. Its circular check-in geofence is a separate one-to-one row containing a PostGIS `geography(Point, 4326)` center and a radius in meters. Separating the geofence keeps exact authorization settings out of ordinary player reads and makes admin policies straightforward.

The admin editor works in latitude/longitude for UI convenience. Its save operation sends numeric coordinates and radius to an admin-only database function, which validates ranges and constructs PostGIS values. Longitude is the X value and must be supplied before latitude when constructing a point.

Use `react-native-maps` for the player map and the admin editor when the Map phase starts. Player maps render facility markers; the admin editor additionally renders a draggable center and radius circle. Map rendering is still only a visualization of data that PostgreSQL validates.

The check-in function constructs a geography point from the submitted device coordinates and uses `ST_DWithin(device_point, geofence_center, radius_m)`. A client-side distance may be shown as a hint, but it must never approve or reject the check-in.

MVP geofences are circular only. A future polygon requirement should add a new geometry representation through a migration; it should not complicate the first schema.

## 7. Secure check-in and checkout

Foreground check-in is one atomic PostgreSQL function call after the app obtains a current device location. The function:

1. derives the user from `auth.uid()`;
2. verifies phone-authenticated, completed account state;
3. locks check-in creation for that user;
4. closes any already-expired open session for that user;
5. verifies that the requested facility is active and has a valid geofence;
6. validates coordinate ranges and performs the PostGIS containment test;
7. inserts a check-in with database timestamps and `expires_at = database now + 90 minutes`;
8. returns a safe result.

The client supplies only the facility ID and current latitude/longitude. It cannot supply user ID, check-in time, expiry, checkout reason, or authorization outcome. The submitted coordinates are used for validation and are not stored in the MVP, reducing location-data retention. Server validation limits ordinary false check-ins but cannot fully defeat OS-level/mock-location spoofing; anti-spoofing is not an MVP requirement.

A partial unique index permits only one row with `checked_out_at IS NULL` per user. This is intentionally stricter than a time-dependent definition of active: the expiry job or next canonical operation closes an expired open row before another is inserted. The constraint plus per-user transactional lock protects against concurrent button taps and multiple devices.

Manual checkout is another function. It can close only the caller's open check-in, sets a database timestamp and `manual` reason, and never deletes the row. If the row is already logically expired, it is closed as `expired` at its existing expiry time instead.

## 8. Server-authoritative 90-minute expiry

Every check-in has a database-generated `expires_at`. Every query, function, count, projection, and policy condition that determines current activity must define an active check-in as `checked_out_at IS NULL AND expires_at > now()`. A row stops being active at `expires_at` even if maintenance runs later.

Supabase Cron runs a PostgreSQL expiry function every minute. It closes due rows with `checked_out_at = expires_at` and reason `expired`. The update preserves history, releases the one-open-check-in constraint, updates facility activity, and emits a Realtime invalidation. This works while the phone is backgrounded, offline, or closed; no JavaScript timer participates in enforcement.

Cron is cleanup and event-delivery infrastructure, not the definition of active state. The application and database must never depend solely on Cron having already closed a row. Cron is operationally monitored, and canonical functions opportunistically close a caller's expired row so a delayed job cannot prevent a new valid check-in.

## 9. Supabase Realtime

For the MVP, use Postgres Changes on one safe `facility_activity` table. Each row contains only facility ID, active count, revision, and update time. Its count is derived only from rows satisfying `checked_out_at IS NULL AND expires_at > now()`. Triggers/functions update it when a facility, check-in, or facility status changes. Raw profiles, roles, geofences, check-ins, and statuses are not placed in the Realtime publication.

- Boards subscribes to activity rows and updates counts or refetches the board query.
- Facility detail subscribes to its facility row. A revision change invalidates/refetches the privacy-safe detail function, including anonymous player summaries and active statuses.
- Map reuses the same facility/activity data as Boards.

Realtime is an invalidation/latency optimization, not the source of truth. Screens fetch an initial snapshot, refetch after reconnect and when the app returns to foreground, and tolerate duplicate/out-of-order notifications. This also ensures expired rows are removed even if a socket event was missed.

Postgres Changes is the smallest implementation for the expected MVP scale. Supabase currently recommends private Broadcast for higher scale/security control; the projection contract allows a later switch without changing screen data models.

## 10. Facility status architecture

Statuses are rows, not free text. The database accepts only the approved enum values through a function. It sets author and timestamps itself and assigns expiry from database time using fixed server rules:

- `courts_closed`: four hours;
- `tournament_at_courts`: eight hours;
- `courts_full`: one hour;
- `courts_wet_unsafe`: two hours;
- `maintenance`: eight hours.

Posting also requires the authenticated caller to have an active check-in at the target facility, defined by database time as `checked_out_at IS NULL AND expires_at > now()`. The function derives the caller from `auth.uid()` and accepts neither a user ID nor a check-in ID. Client-side visibility of the posting controls is only a user-experience guard; the database authorization is decisive.

The client cannot choose or extend the expiry. Expired/ended rows are retained for audit but excluded from player reads.

Multiple checked-in players may independently report the same status. Canonical projections group logically active rows by facility and status type and count distinct authors without exposing their identities. A repeat submission by the same author for the same facility and still-active status type returns the existing row unchanged, so retries and check-out/check-in cycles cannot inflate confidence or extend expiry. The qualifying active check-in row serializes concurrent submissions from one user. Once the prior report is no longer logically active, that user may create a new report. Each status type is independent, so one user and one facility may have active reports of several different types.

The displayed facility activity state is derived rather than separately editable:

1. admin-inactive facility;
2. active `courts_closed` status;
3. active `maintenance` status;
4. active `courts_wet_unsafe` status;
5. active `tournament_at_courts` status;
6. active `courts_full` status;
7. `active` when current player count is greater than zero;
8. `quiet` otherwise.

This priority makes the Board deterministic if statuses overlap. Status mutations increment the facility activity revision so clients refetch.

`list_facilities` returns the unique-reporter count for the status selected by this priority. `facility_activity` does not store status counts; it remains an invalidation-only Realtime projection, and clients refetch database-time-authoritative aggregates.

## 11. Admin facility management

Admin screens use the same Supabase session and native component system as player screens. Admins can list all facilities, create/edit data, adjust the map point and circular geofence, and activate/deactivate facilities.

Database checks validate required names/addresses, coordinate ranges, positive radius, nonnegative court count, and timestamps. RLS checks database role membership for every read/write. Exact geofence reads and writes are admin-only.

The admin editor loads one facility through `admin_get_facility(facility_id)`. This admin-only function projects the public facility point and private geofence center into explicit latitude/longitude values, returns a nullable circular geofence, and omits audit user IDs and player activity. Player facility functions remain separate and never expose private geofence geometry. MVP admins are global; there is no implemented organization model or organization-scoped administration.

Facilities are deactivated, not deleted, so check-in and status history keeps valid foreign keys. Deactivation should be a transaction that marks the facility inactive, closes any open check-ins with `facility_deactivated`, ends active statuses, and bumps its activity revision. Reactivation does not restore old sessions or statuses.

## 12. Foreground location

Browsing Boards, facility details, and Map does not request location permission. Map can show facilities without the user's position.

Only a check-in attempt requests foreground permission and a fresh location through `expo-location`. Denial, restricted permission, timeout, or inability to obtain a coordinate produces a recoverable message and no database mutation. No GPS accuracy threshold is enforced in the initial MVP, though accuracy may be logged locally for diagnostics without being used for authorization.

Directions use the external maps application and do not require CourtCheck to obtain the user's location; the maps app can select the current origin. iOS favors Apple Maps. Android support is tested later on a physical device.

## 13. Later background location and 15-minute checkout

Background behavior is a later, separately consented feature and must not weaken the 90-minute cap. It requires an Expo development build and top-level background task registration; it is not implemented for the Expo Go phase.

When added:

1. Register monitoring only while a check-in is open and background permission is granted.
2. On an exit/location report, send the current coordinates and check-in ID to a database function.
3. The database verifies ownership and independently evaluates the coordinates against the stored geofence.
4. The first server-confirmed outside report sets `outside_since` using database time.
5. A server-confirmed inside report clears `outside_since`.
6. The expiry job also closes a row as `left_geofence` after `outside_since` has remained set for 15 minutes.
7. Stop device monitoring when the check-in closes.

Device timestamps are informational; database receipt time drives the grace period. If background delivery is unavailable or unreliable, the existing 90-minute expiry still closes the session. Background monitoring does not silently extend a check-in beyond 90 minutes.

## 14. Environment variables and secrets

Client configuration uses:

- `EXPO_PUBLIC_SUPABASE_URL`;
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Expo inlines `EXPO_PUBLIC_` variables into the shipped bundle, so these values are public configuration, not secrets. The Supabase publishable key is appropriate for the mobile client only because all exposed data is protected by grants and RLS.

Commit an `.env.example` with placeholders and keep `.env.local` untracked. Use separate Supabase projects/keys for development and production. When EAS is introduced, configure the same names per EAS environment rather than overloading `NODE_ENV`.

Never put a Supabase secret/service-role key, database password, SMS provider credential, or other privileged token in the Expo environment or repository. Database Cron needs no mobile-held secret. SMS provider credentials remain in Supabase's server-side configuration.

## 15. Development and testing strategy

Initial mobile work targets a physical iPhone in Expo Go:

- run the standard Expo development server and scan the QR code;
- test foreground location permission states and actual inside/outside geofence behavior on the device;
- use a hosted development Supabase project for phone OTP and device-to-cloud location tests;
- configure Twilio through Supabase Auth for production SMS delivery;
- use Supabase test OTP/test-number capabilities for routine development wherever possible, with limited real Twilio integration checks;
- use a second iPhone or iOS Simulator as the second Realtime client when needed;
- do not install Android Studio or add Android-only development tooling.

Use versioned SQL migrations in `supabase/migrations`. Validate database behavior separately from UI:

- schema constraints and enum values;
- RLS as unauthenticated, normal user, other user, and admin;
- inside/outside and inactive-facility check-in cases;
- concurrent one-active-check-in attempts;
- manual and scheduled expiry history;
- safe RPC output (no phone, email, stable user IDs, or geofence settings);
- activity projection and Realtime updates.

For application changes, run TypeScript checking and Expo linting. Add focused unit tests for pure formatting/state helpers and screen/integration tests only where behavior warrants them. The first end-to-end acceptance test uses two sessions: one user checks in/out and the second sees both count changes without refreshing.

Move to an Expo development build only when background location/geofencing or another unsupported native configuration is implemented. Later test Android on a physical Android phone.

## 16. First development phase

The first phase should deliver the smallest security-complete vertical slice:

- replace the starter presentation with the project foundation and design tokens;
- add only the agreed Supabase/auth/location dependencies needed by this slice;
- add migrations, generated database types, constraints, RLS, canonical functions, and expiry Cron;
- implement phone OTP, onboarding, session bootstrap, and role routing;
- seed facilities through migrations/trusted tooling;
- implement player Boards and facility detail;
- implement foreground check-in, manual checkout, 90-minute expiry, and safe Realtime counts;
- validate the two-client end-to-end milestone on iPhone.

Do not include in phase one:

- background location, geofencing tasks, or 15-minute leave checkout;
- Android Studio, Android-specific development setup, or store builds;
- polygon geofences;
- arbitrary user status text;
- push notifications, chat, invitations, social graphs, analytics pipelines, or offline sync;
- a separate admin app/backend, Redux, Firebase, FastAPI, or speculative service abstractions;
- destructive facility deletion.

Map polish, preset statuses, directions, and the full admin management/geofence UI follow the first vertical slice in the existing product priority. The database and routes are designed for them, but phase one should not implement their screens prematurely.

## 17. Finalized product decisions

- Authentication is phone OTP-only; production has no password step.
- Production SMS delivery uses Twilio through Supabase Auth.
- Development uses Supabase test OTP/test-number capabilities wherever possible.
- Status expiry is assigned by the database: four hours for `courts_closed`, eight hours for `tournament_at_courts`, one hour for `courts_full`, two hours for `courts_wet_unsafe`, and eight hours for `maintenance`.
- Cron may close expired check-ins, but all active-state queries and projections independently require `expires_at > now()`.

## Official platform references

- [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [Supabase Realtime database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
