# Rollout, migration and operational runbook

## Release modes

Treat the public synthetic demonstration and private research application as separate delivery targets. A public UI release can improve interaction without exposing a source file. A private importer or model worker must not become hosted functionality by accident.

Each release identifies its corpus mode, schema version, fixture revision, workspace compatibility, analysis artifacts and model-processing capability. Avoid “everything is done” language when only a fixture interaction has shipped.

## Before an implementation release

Inspect repository state and current instructions. Identify the exact baseline, preserve unrelated edits and run the relevant context preflight. Name the work-package IDs being implemented and the acceptance evidence required.

Verify public/private configuration, environment flags, ignored storage and export defaults. A production build must not probe a developer’s private service. An API key must not appear in browser bundles, diagnostics or tracked examples.

For UI work, run TypeScript and a production build in addition to appropriate tests. Do not rebuild the same output directory underneath a running production test server. Keep task-owned development/test processes distinct from existing user servers.

## Fixture upgrade runbook

The current public database stores a saved workspace and otherwise falls back to the packaged fixture. Adding more fixture JSON alone is not a complete upgrade path for users with existing data.

Introduce an explicit fixture revision independent of schema/workspace versions. Determine which packaged entities are untouched seed material and which have user edits. Add new entities by stable identity, preserve old revisions and decisions, and record the upgrade event.

If a packaged item changes, do not mutate the user’s reviewed revision in place. Present a successor/proposed update or preserve the existing item with a conflict report. New demonstration material should become discoverable without a forced reset.

Test a saved teaching, changed link, rejected proposal, lock, stale expression and manual ordering before and after upgrade. Provide a recovery export before a destructive migration. Reset remains an explicit user operation, not a hidden content installer.

## SQLite and artifact migrations

Apply ordered migrations with recorded versions and recoverable transaction boundaries. Check foreign keys and graph constraints after upgrade. Back up before transformations that could lose data, and verify restore against the exact prior schema/artifacts.

Projection and cluster runs need versioned artifact compatibility. A new software version may create a new run rather than overwriting a fitted map. Old accepted editorial decisions continue to reference their original source/evidence revisions.

Detect missing/corrupt artifact files and report which run depends on them. Do not replace a missing vector matrix with a new unapproved external embedding run during startup.

## Private-source readiness checklist

- Authorized file and acquisition details are recorded.
- The actual format is text-readable and no DRM workaround is required.
- Original/raw/normalized artifacts are private and hashed.
- Canonical segmentation and exclusions are reviewed.
- External processing consent is separate from import approval.
- Applicable budgets and credentials are configured only for an approved run.
- Shareable export excludes the full translation by default.

If one gate is missing, continue independent local/fixture work and report the specific blocker. Do not repeatedly ask for already-granted permission, but do not invent a new approval because time has passed.

## Model-run operations

Start bounded work, inspect progress and failed items, cancel safely, resume from checkpoints and reconcile unknown outcomes. Record estimated and observed costs distinctly. A completed API call is not an approved conclusion.

When an adapter or provider setting changes, verify compatibility and record a new configuration identity. Do not silently downgrade the embedding model/dimensions to get around an operational failure.

## Publish and verify

Use the repository’s established deployment path when a public release is authorized. Verify the intended project/team/environment and exact commit. Wait for the authoritative production alias to reference the expected ready deployment before claiming the site is updated.

Run live smoke checks for both language entry routes, default two-pane highlights, expression mapping, map/list selection and public private-proxy absence. Check browser cookies/headers according to the site’s no-cookie requirement. A transient connection failure should be distinguished from a product failure and retried in a bounded way.

For a documentation-only change, link and formatting checks are appropriate; do not claim UI features or PCA computations were implemented merely because plans were committed.

## Incident/recovery paths

| Incident | Immediate action | Recovery evidence |
|---|---|---|
| Import missegmentation | Stop dependent processing | New inspected segmentation revision |
| Broken anchor | Mark affected support invalid/stale | Exact revalidation and review |
| Lost artifact | Preserve run identity and report missing input | Verified restore or deliberate new run |
| Budget overrun risk | Stop new dispatches | Reservation/usage reconciliation |
| Incorrect public/private routing | Remove exposure and verify build | No private requests/source endpoints |
| Bad fixture migration | Preserve user data and recovery copy | Tested rollback or corrected migration |

## Completion gate

A release can be reproduced, an existing project can upgrade without losing editorial work, private material stays private, and the operator can explain what was tested, what is blocked and how to recover. Operational convenience must not erase provenance or override the user’s source/budget boundaries.
