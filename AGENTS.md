# CourtCheck

CourtCheck is a recreational pickleball court check-in mobile application.

## Stack

- React Native
- Expo
- Expo Router
- TypeScript
- Supabase
- PostgreSQL
- PostGIS
- Supabase Auth
- Supabase Realtime
- expo-location
- react-native-maps

Do not add another backend unless explicitly requested.

## Project structure

Application source code lives inside `src/`.

Use:

- `src/app` for Expo Router routes/screens
- `src/components` for reusable UI components
- `src/features` for feature-specific application logic
- `src/hooks` for reusable React hooks
- `src/lib` for integrations and utilities such as Supabase
- `src/constants` for shared constants
- `src/types` for shared TypeScript types
- `docs` for product and architecture documentation
- `supabase` for migrations and database-related files

Do not create duplicate root-level application source folders.

## Application architecture

CourtCheck is ONE Expo mobile application.

It contains both:

- normal player interface
- administrator interface

There is no separate admin web application.

After authentication:

- role=user → normal CourtCheck interface
- role=admin → admin interface

Admins may optionally access the normal player interface.

## Authentication

- Phone number is required.
- SMS verification is mandatory.
- Email is optional.
- Users confirm they are 18+.
- Users receive a system-generated anonymous username.
- Experience levels:
  - Newbie
  - Beginner
  - Intermediate
  - Advanced
  - Pro

## Roles

Initial roles:

- user
- admin

Never rely solely on client-side role checks.

Administrative privileges must also be enforced using Supabase RLS/database policies.

Normal users must never be able to:

- create facilities
- modify facilities
- modify geofences
- perform admin-only operations

## Check-in rules

- Initial check-in requires foreground location.
- Users may only check in when inside a facility geofence.
- The database/server is authoritative for geofence validation.
- Never authorize check-in using only a client-side distance calculation.
- A user may have only one active check-in.
- Users can manually check out.
- Check-ins have server-authoritative expiry.
- Without background-location support, default expiry is 90 minutes.

Background geofence auto-checkout is a later feature.

## UI

`docs/prototype.html` will be the visual source of truth once added.

Do not copy or embed its HTML.

Recreate the design using native React Native components.

## Development

Initially optimize for iOS development using Expo Go on a physical iPhone.

Do not add Android-specific tooling merely for development.

Android will be tested later using a real Android device.

Background location/geofencing will eventually require Expo development builds.

## Package management

This project uses npm.

Use npm commands and preserve `package-lock.json`.

Do not introduce pnpm or yarn unless explicitly requested.

## Coding rules

- TypeScript strict mode.
- Prefer small focused components.
- Avoid unnecessary abstractions.
- Avoid new dependencies unless justified.
- Do not perform unrelated refactors.
- Do not rewrite working code unnecessarily.
- Never expose secrets in client code.
- Run type checking/linting after meaningful changes.

## Codex workflow

For every task:

1. Read this file.
2. Inspect only relevant files.
3. State a short implementation plan.
4. Implement only the requested scope.
5. Run relevant validation.
6. Summarize changed files.
7. Mention remaining issues.

Do not implement future phases unless explicitly requested.
