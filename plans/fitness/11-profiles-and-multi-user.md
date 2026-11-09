# 11 — Self-service profiles and multi-user training

Implemented 2026-11-09. `/fitness/profile` and `/ru/fitness/profile` support personal registration, name/privacy,
optional personal measurements and first-plan construction or a reviewed pivot. No invite/admin grant is needed
for an ordinary personal profile. New accounts are private non-owners; owner administration remains separate.

## Data and authorization

`20261109142245_fitness_profiles_self_service.sql` adds authenticated registration/update RPCs. Both check the
session identity and optional expected-account ID; neither accepts an ownership role or arbitrary target user.
Direct profile UPDATE is restricted to settings. Every fitness table uses own-user or explicitly public-profile
SELECT policies; row writes stay own-user. New `fitness_measurements` rows hold independent dated centimetre
observations, optional notes and left/right sites. Bodyweight and exercise weights retain their existing tables.
Public sharing deliberately includes all fitness data, including weight, circumferences and settings; the UI
states this explicitly before opt-in. Sharing revocation removes visitor mirrors on refresh. Account changes
clear private snapshots and remount local UI drafts. Non-admin registration never silently imports other local logs.

## Plans

The primary goal controls load/reps/rest/progression. Up to two supporting goals record ordered priorities and go
into adviser context. TrainingPreferences persist upper/full/custom scope and actual catalog group exclusions.
The constructor supports plan/day names, day order, per-day exercises, sets/reps/rest, blank custom starts and
pivot reasons. Save previews changes, archives the prior version and records history; stale or empty plans cannot
save. Existing exercise baselines and the frozen prescription of an active workout are preserved.

## Verification

Store tests cover registration, auth races, account switches, offline/private copies, sharing revocation and
measurement-only records. Native SQL tests cover anon/stranger/own reads and writes for every fitness table,
role escalation, identity mismatch, known measurement sites and valid cm ranges. Browser tests exercise registration
with entered choices retained, constructor persistence/archive, circumference reload/comparison, empty plans and
private draft removal on sign-out. See `docs/development-review-10-loops.md` for final counts and artifacts.

Public `/fitness/u/[name]` directory/profile routes, separate per-field visibility and invitations are not needed
for personal self-service accounts and are not claimed implemented.
