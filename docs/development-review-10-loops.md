# Ten critique and implementation loops — 2026-11-09

Target: self-service personal fitness profiles; prioritized multiple goals; flexible plan construction, exclusions
(including no legs), adjustments and safe pivots; rigorous trip creation with selected dates and verified events
accepted explicitly into fixed itinerary commitments. Exactly ten critique/fix passes, maximum ten. User steering added dated body measurements, site-wide UI/discoverability and easy-set guidance during these same ten passes.

## Scope inventory

- Fitness public entrypoints: EN/RU profile, program, home, train, progress, gyms, adviser, offline fallback.
- Auth/profile registration, ownership, privacy, account switching, local storage/outbox, SQL/RLS and Realtime.
- Primary/secondary goals, templates/custom plans, muscle exclusions, days/exercises, save/version/history/pivot.
- Baselines and running-session continuity through later plan or profile changes.
- Trip creation: undated compatibility, selected dates, event discovery, source verification, explicit acceptance,
  immutable dated commitments, generation failure/retry, persistence and rendering.
- Cookie-free first-party operation: localStorage auth/preferences/data, no middleware/session cookies, static and live header audits; external Google sign-in is a separate origin.
- Site-wide home/header navigation and design, including Fitness discovery on phones and desktop.
- Dated weigh-ins/circumferences with separate sides and honest effort guidance for reps above/below plan.
- Evidence: meaningful core/SQL/browser tests, types/build/lint, phone UI, source citations and accurate docs.
- Excluded: committing/pushing/deploying (requires the owner's explicit instruction), booking/ticket purchases,
  silent public sharing, public profile-directory discovery (not needed for personal self-service profiles).

## Closure ledger

| Acceptance claim | Owner | Code/proof | Status | Remaining / next action |
| --- | --- | --- | --- | --- |
| Explicit private self-registration and own profile edits | profiles_backend + main | store/profile-core tests; personal browser registration | verified | none |
| Private fitness records isolated across users and anonymous access | profiles_backend + main | native SQL; 134 store tests; browser sign-out draft check | verified | none |
| Prioritized goals and muscle-scope preferences | plan_builder + main | builder/program/template tests; persisted browser goal/day pivot | verified | none |
| Plan construction/editing and pivot with history | plan_builder + main | builder/calibration tests; archive/empty-draft browser flows | verified | none |
| Profile onboarding, EN/RU, optional personal measurements | main | profile/measurement core; registration/reload/comparison browser; 40 visual views | verified | none |
| Existing calibration and session behavior retained | main + critic | calibration/coaching/tracker tests; full workout/reopen/offline browser suite | verified | none |
| Trip selected dates and creation pipeline | trip_dates_events + main | 64 trip tests; 7 creation/rebuild/error browser scenarios | verified | none |
| Verified event recommendations, explicit acceptance and locked commitments | trip_dates_events + main + critic | source/event tests; DST/end-date/stream/text adversarial repros; consent browser | verified | none |
| Complete public-flow evidence and documentation | main | 1,015 automated tests; 113 unique browser checks; 40 visual views; build/type/lint/cookie/SQL | verified | none |
| Site-wide UI and Fitness discovery | site_design + main | header tests; home/header EN/RU visual QA at360/390/430/1280 | verified | none |
| No first-party cookie writes or Set-Cookie headers | main | final build scan and live representative-route audit | verified | none |

## Pass log

1. **Product and onboarding contract.** Critique: profiles currently require an admin allow-list; the constructor
   has only one goal and no persistent body-scope policy. Added additive preferences types, profile route/navigation,
   and localizable profile-input validation. Proof: `node --test tests/fitness/profile-core.test.mjs`.
   Incompleteness challenge: a profile form alone cannot establish privacy or safe per-user data; backend and
   constructor remain in progress. New user steering adds trip dates/events to this same scope and ledger.

2. **Training goals and lasting exclusions.** Critique: changing a goal/template/day count could replace the
   user's choices, and the catalog has quads/hamstrings/adductors rather than a real `legs` group. Added primary
   prescription with two supporting priorities, canonical lower-body exclusions and legacy alias normalization;
   exclusions also guard runtime planning, substitutions and adviser candidates. Proof: 36 builder/program/template
   tests and 14 adviser tests; profile helpers and calibration regression checks also pass. Challenge: public UI
   persistence and custom-day workflows still need direct browser evidence.
3. **Database authorization and offline identity.** Critique: the original public SELECT policies expose every
   person's rows; local adoption and cached drafts can cross account boundaries. Added explicit private non-owner
   registration, own-account profile RPCs pinned to the initiating identity, settings-only direct profile updates,
   profile-gated reads on all fitness tables, and account-isolated store transitions. Proof: 134 store tests and
   native SQL private/stranger/anon/owner-escalation/sharing-revocation checks. Migration applied to dedicated
   ilyadays only. Challenge: frontend async state needs its own account-boundary review.
4. **Onboarding and shared-device privacy.** Independent critique found a form remount during registration and
   unsaved program/measurement drafts surviving sign-out. Profile form now survives registration; the provider
   remounts child UI per account and hides mismatched private snapshots synchronously. Profile preference edits
   use tested shared helpers instead of rebuilding exclusions destructively. Proof: focused profile/builder/
   calibration checks (26 tests). Challenge: mocked sign-in/registration/sign-out browser flows remain to run.
5. **Measurement integrity and optional inputs.** Added independent dated circumference records, left/right arm,
   forearm, thigh and calf values, waist/chest/hips/neck, note, comparison and deletion. No scale weight is invented
   for circumference-only records; zeros/unknown sites/impossible dates/future dates are rejected. Privacy follows
   the explicitly disclosed profile-wide sharing choice, private by default. Proof: measurement-core tests and SQL
   ownership/validation checks. Challenge: browser saving/reload/comparison and units still need verification.
6. **Plan pivot and historical continuity.** Critique: a profile's full-body selection changed metadata without
   adding lower-body work, while custom/upper edits could erase prior exclusions. Shared profile pivot helpers
   now retain exclusions and add actual lower work on an explicit full-body transition. Constructor supports blank
   custom days, day names/order, exercise choices, review diff, version archive and pivot reason. Existing exercise
   baselines remain, and started sessions keep their frozen original program. Empty/stale drafts cannot save.
   Proof: pivot/builder/calibration tests and adviser validation; browser archive/reload flow pending. Challenge:
   the broad target now also includes live trip-date/event recommendations and schedule integrity.

7. **Trip creation and calendar correctness.** Added optional inclusive stay dates, route-day bounds and destination
   time zone. Independent critique reproduced UTC/local-day and DST errors; source timestamps now normalize into
   the selected destination zone and retain absolute instants. Ambiguous/nonexistent unzoned clocks and malformed
   or nonpositive end dates are rejected. Existing undated creation stays supported. Trip core/type checks pass;
   latest browser checks are running against the coordinated production build.
8. **Live-source truth and server safety.** Recommendations originate in live search sources and checked publisher
   Event JSON-LD, not invented model assertions. Verification authenticates the user, pins vetted public IPv4 DNS,
   revalidates redirects, limits bytes/time/URLs and rejects unsafe addresses. Independent critique reproduced
   unbounded draining of redirect/error bodies; these are now destroyed. A final malformed-HTML challenge found
   quadratic JSON-LD scans; extraction is linear and tested against a 1.575 MB unclosed-script payload. All 63 trip
   tests pass. Challenge: unavailable structured listings must remain visibly incomplete, never fabricated results.
9. **Consent, immutable events and schedule conflicts.** Suggested events remain unselected until explicit user
   agreement. Accepted commitments are deep-copied, source-linked and preserved in new saved/rebuilt trips. Changed
   city/dates/zone cannot silently relocate them. Deterministic schedules reserve event windows and transition
   buffers, rejecting overlaps/insufficient daily time; failed storage prevents navigation to a nonexistent trip.
   Claims now match the existing newest-20-trips retention limit. Browser consent/removal/reload/rebuild/retry/error
   scenarios await final results. Challenge: automatic ticketing is excluded, and opening/transit estimates need review.
10. **Public UI, integrated behavior and final adversarial gate.** User added site design/visibility
   and guidance for exceeding planned reps. New persistent Food/Travel/Fitness navigation and Fitness-first home
   actions improve discoverability; production absence is an undeployed-build issue, not an absent local route.
   Added profile/circumference browser tests; four initial personal-profile checks pass, including a registration
   state race and private-draft removal. Empty custom plans are blocked. Same-day measurement ordering now uses
   observation entry time, not random IDs. Easy-set guidance is being verified: target effort, actual reps above plan,
   conservative same-weight adjustments and no override of prior missed work. Remaining gate: final full tests,
   latest browser flows, multilingual phone/desktop screenshots, docs/claim alignment and a publishing-ready preview.


## Final closure gate

All ten passes completed. The original and steering requests were re-read against the scope inventory; every
required implementation/verification row above is verified. Remaining work within this scoped implementation:
**none**. Publishing is explicitly excluded pending the owner's go-ahead under HANDOVER §7; the preview is running
at `http://localhost:3000`. No commit/push or production deployment was made.

- `npm test`: **1,015 passed**. Includes 64 trip tests, profile/measurement/builder/coaching regressions and existing
  application suites. `npm run typecheck`, `npm run lint`, `npm run build`: pass on final source.
- Full fitness browser run: **105 passed**, one RU lat-pulldown page hit an external `networkidle` timeout; that exact
  smoke case passed on targeted retry (5.83 s) without a code change. Thus all **106 unique fitness checks** verified.
- Trip creation browser suite: **7 passed**, with deterministic APIs and no billed live generation/search calls.
- Visual QA: **40 views**, EN/RU pages at360/390/430/1280, HTTP200, no page errors or horizontal overflow. Screenshots
  and report: `output/site-and-personal-plans-qa/`. Home, profile and desktop screenshots visually inspected.
- Native SQL privacy/measurement checks pass; hosted project confirms RLS on all nine fitness tables, private profile
  default, anonymous registration denied and authenticated registration granted. Hosted migration:
  `20261109143733 fitness_profiles_self_service`.
- Static and live no-cookie audit and `git diff --check` pass. Project-memory pending queue is empty.
- Final independent adversarial check found another unbounded regex on publisher text. Raw text is now bounded
  before sanitization, URLs before parsing, and a 1.5 MB hostile-field regression passes. Earlier linear script scan,
  stream destruction and UTC/DST/end-date fixes are also covered. No unresolved critic findings remain.

Exact new source verification is deliberately limited to accessible source-confirmed structured event listings.
Body circumferences are observations, not a diagnosis or a muscle/fat estimate. Rep/RIR coaching and exact next-set
thresholds remain conservative defaults rather than validated individual prescriptions. These limits are reflected
in product copy and `docs/trip-planning.md` / `docs/fitness-setup.md`.
