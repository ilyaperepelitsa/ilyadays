# Frontend design review — 9 November 2026

The profile and program editor are working product screens: show useful choices and actual exercise information without a long sequence of full-width explanation cards. Preserve the site's existing palette and editorial branding, with a compact sans-serif hierarchy for the working screens.

The user requested a Claude consultation. Claude Code reviewed the existing screenshots using the installed official `frontend-design` skill, with read-only tools. Its main recommendations were to put exercises alongside compact settings, reduce repeated headings, use real exercise thumbnails, keep the mobile preview available while editing, and disclose long explanations. The consultation and screenshot artifacts are kept under ignored `output/interface-review/`.

## Implemented

- Shared goal choices use native radio groups, real rep/RIR parameters, visible selection borders and normal keyboard behavior. Profile onboarding and program editing use the same component.
- Profile creation has compact identity/measurement fields and an actual generated training-week preview. The desktop preview stays beside the form; the phone summary opens a native modal with the same exercise information. Preview pictures, prescriptions and estimated durations come from the existing catalog and program logic. No placeholder loads are shown.
- Program editing places settings beside illustrated workout days on desktop. Phones show workouts first and expose settings through an explicit disclosure button. Exercise editing, search and substitutions include existing technique thumbnails; consistent stroke icons support add, edit, swap and reorder actions.
- Long goal explanations remain available under disclosures. Uncalibrated exercise rows say to calibrate first. Scientific progression rules, exclusions, profile privacy and versioned plan saves are unchanged.
- Fitness navigation keeps core actions visible and offers the other sections through a native disclosure. Escape returns focus, outside clicks close it, and the current secondary section remains visible on the trigger.
- Trip creation has section anchors and a planning guide, responsive form panels and shorter task-oriented introductory copy.

## Acceptance

Verify private registration with submitted goals, persisted exclusions and plan changes, goal-radio keyboard behavior, modal open/Escape/focus restoration, desktop exercise visibility, EN/RU navigation, light/dark layouts, no horizontal overflow, and the no-cookie audit. Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` before release.

Browser checks use `FITNESS_E2E_BASE=http://localhost:3001` and the existing Python Playwright suites. Do not rebuild `.next` while the production test server is serving it; restart the server after each build.

Validated before release: 1,015 automated tests, typecheck, production build, lint, 90 fitness page/profile browser checks, three additional plan regressions, seven trip-creation browser scenarios, 88 responsive light/dark views, and the local no-cookie audit. Claude's final review of four finished screenshots returned PASS; keyboard, dialog and save/reload behavior were verified separately in the browser tests.


## Shared controls and personal focus — 2026-11-09 follow-up

Installed actual shadcn/ui Radix toggle primitives and Tailwind semantic tokens. The rest of the site retains authored CSS; see `docs/ui-system.md` for the migration boundary. Explorer now has expandable multi-muscle and goal choices, compact selected summaries and an explicit plan handoff. Profile and constructor share checked selection chips with strong borders, keyboard navigation and readable disabled states. Scope exclusions and sign-in requirements explain unavailable actions. New focused plans use neutral day names rather than the starting template's old muscle emphasis; existing saved/custom names remain intact.

Claude consultation used the full installed official frontend-design skill and four local screenshots with read-only tools. The first review found no blocking layout break and identified seven useful fixes. Addressed disabled Save explanation, excluded-muscle explanation/contrast, non-colour selection cues, filter/goal ordering, label casing, personal-day naming and narrow Russian field alignment. RIR values remain together. Secondary panel-heading and footer-spacing suggestions do not affect the current interaction flow.

Final browser evidence is in ignored `output/fitness-machine-specs/`: 16 EN/RU × 390/1280px × light/dark views across explorer/profile, with 44px controls, no horizontal overflow, no page errors and zero browser cookies. Eleven browser scenarios additionally prove URL persistence, several goals, handoff, saved profile preferences, exclusions, keyboard navigation, account boundaries and history preservation. Typecheck, build, lint and 1,030 unit tests pass. These checks do not claim every existing site component was converted to shadcn.
