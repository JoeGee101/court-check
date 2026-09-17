# CourtCheck Product Requirements

## 1. Product

CourtCheck is a mobile-first recreational pickleball court check-in application.

It allows players to see who is currently playing at nearby public pickleball facilities before deciding where to go.

Initial target market is Las Vegas / Clark County.

The application serves both normal players and park administrators through one mobile application.

---

## 2. User Roles

### User

Normal players can:

- Create and manage an account.
- Browse facilities.
- View facilities on a map.
- View current facility activity.
- View anonymous checked-in players and their experience levels.
- Check in when physically present at a facility.
- Check out manually.
- Post allowed preset facility statuses.
- Open directions to a facility.
- Manage their profile.

### Admin

Admins use the same CourtCheck mobile application.

Admins can:

- Access an admin interface after authentication.
- View facilities.
- Create facilities.
- Edit facilities.
- Activate/deactivate facilities.
- Configure facility information and amenities.
- Define and edit facility geofences.
- Access the normal player experience when needed.

Administrative privileges must be enforced by the backend/database and not only by UI restrictions.

---

## 3. Authentication and Onboarding

Phone number is required.

Flow:

1. Enter phone number.
2. Receive 6-digit SMS verification code.
3. Verify phone number.
4. Complete account setup.
5. Optional email.
6. User must confirm they are 18 or older.
7. System generates an anonymous username.
8. User selects experience level.
9. Account becomes usable.

Experience levels:

- Newbie
- Beginner
- Intermediate
- Advanced
- Pro

Example anonymous username:

SwiftPaddle482

Supabase Auth will be used.

SMS delivery provider will be configured separately.

---

## 4. Player Navigation

Primary normal-user navigation:

- Boards
- Map
- Profile

---

## 5. Boards

Boards is the primary facility discovery/activity screen.

Each facility card should display useful information such as:

- Facility name
- Address
- Current checked-in player count
- Court count
- Lights availability
- Hours
- Current activity state

Users can search facilities.

The live count must update without requiring manual refresh.

---

## 6. Map

Users can browse facilities geographically.

Map should:

- Display facility markers.
- Display current activity/player count where appropriate.
- Allow selecting a facility.
- Navigate to facility details.
- Show the user's position when permission is available.

Location permission is NOT required merely to browse CourtCheck.

---

## 7. Facility Detail

Facility detail should include:

- Name
- Address
- Hours
- Court count
- Lights
- Restrooms
- Water
- Current checked-in count
- Anonymous checked-in players
- Player experience levels
- Current facility statuses
- Check In / Check Out
- Directions

Facility information may indicate that it has been verified by the relevant parks authority.

---

## 8. Check-In

A verified authenticated user may check in at any active listed facility.

Check-in requires foreground location.

Flow:

1. User taps Check In.
2. CourtCheck checks foreground location permission.
3. If necessary, request permission.
4. Obtain current device coordinates.
5. Send coordinates and facility ID to authoritative backend/database logic.
6. Determine whether coordinates are inside the facility geofence.
7. If inside, create check-in.
8. If outside, reject check-in.

The mobile client must NOT be authoritative for geofence validation.

PostGIS/server-side database logic should validate location.

A user may have only one active check-in at a time.

No GPS accuracy threshold is required for the initial MVP.

---

## 9. Checkout

Users can manually check out.

Check-in history should be preserved.

Checkout records should support:

- checked-in time
- checked-out time
- checkout reason

---

## 10. Automatic Checkout

Two mechanisms are planned.

### Fallback

Every check-in receives a server-authoritative expiration.

If background location monitoring is unavailable, the session expires after 90 minutes.

This must not depend on a JavaScript timer running on the phone.

### Background Location

This is a later implementation phase.

When reliable background location is available:

1. Detect that the user has left the facility geofence.
2. Begin a 15-minute grace period.
3. If the user returns inside, cancel pending checkout.
4. If continuously outside for 15 minutes, automatically check out.

If background monitoring is unavailable/unreliable, the 90-minute fallback remains.

---

## 11. Realtime Activity

Supabase Realtime will be used.

Relevant screens should update automatically when:

- Someone checks in.
- Someone checks out.
- A check-in expires.
- Facility status changes.

Users should not need to manually refresh the board.

---

## 12. Facility Statuses

Initial preset statuses:

- Courts closed — four hours
- Tournament / Event — eight hours
- Courts full — one hour
- Courts wet / unsafe — two hours
- Maintenance — eight hours

A player may post a status only while they have a currently active check-in at that exact facility. The database must enforce this using the authenticated caller and database time; hiding status actions in the client is only a user-experience guard.

Independent reports from different checked-in players increase confidence in a status. Player-facing counts represent unique reporting users for each facility and status type. Repeating the same still-active report by the same user is idempotent: it does not add another report or extend its expiry. All five status types are counted independently and may coexist. Aggregate status displays do not expose reporter identities.

Boards and Map summarize only the highest-priority logically active status and its reporter count: Courts closed, Maintenance, Courts wet / unsafe, Tournament / Event, Courts full, Active, then Quiet. Facility Detail shows every logically active aggregate status type in that order.

Statuses must have:

- facility
- author
- created_at
- expires_at

Expired statuses should stop appearing.

MVP does not allow arbitrary user-written status messages.

---

## 13. Directions

Facility detail provides a Directions action.

CourtCheck should open the device's appropriate maps application rather than implementing turn-by-turn navigation.

iOS should favor Apple Maps.

Android should use an appropriate native/Google Maps flow.

---

## 14. Admin Facility Management

Admins can manage facilities inside the same Expo application.

Facility information includes:

- Name
- Address
- Coordinates
- Hours
- Court count
- Lights
- Restrooms
- Water
- Active/inactive state
- Geofence

---

## 15. Geofences

Admins manually configure facility geofences.

MVP uses circular geofences.

A geofence consists conceptually of:

- center latitude/longitude
- radius in meters

Admin should be able to view the facility on a map, position the geofence and adjust its radius.

Polygon geofences are not required for MVP.

PostGIS will be used for authoritative spatial validation.

---

## 16. Technology

Mobile:

- React Native
- Expo
- Expo Router
- TypeScript

Backend:

- Supabase

Database:

- PostgreSQL
- PostGIS

Authentication:

- Supabase Auth
- SMS provider configured through Supabase

Realtime:

- Supabase Realtime

Location:

- expo-location

Maps:

- React Native compatible map implementation selected during development

---

## 17. Development Strategy

Initial development and testing:

- macOS development machine
- VS Code
- physical iPhone
- Expo Go

Do not require Android Studio.

Android testing will later be performed using a physical Android phone.

Move from Expo Go to an Expo development build when native/background-location requirements make it necessary.

---

## 18. MVP Priority

Build the product in this order:

1. Project foundation
2. Database
3. Authentication/onboarding
4. Role-based routing
5. Boards
6. Facility detail
7. Map
8. Foreground geofence check-in
9. Realtime activity
10. Manual checkout
11. 90-minute expiry
12. Facility statuses
13. Directions
14. Admin interface
15. Facility management
16. Admin geofence editor
17. Development build
18. Background auto-checkout
19. Android testing
20. Production hardening
21. Store submission

The first important end-to-end milestone is:

User signs in → views facility → checks in → another client sees the live activity change → user checks out → activity updates again.

---

## 19. Design Reference

`docs/prototype.html` is the visual reference for CourtCheck.

It defines the intended visual direction and primary screen hierarchy.

It should be recreated using native React Native components.

Do not directly convert, embed, or ship the HTML prototype.
