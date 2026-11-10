# Local backend, storage, API and migration plan

## Existing architecture to preserve deliberately

The repository already has a Next/React/TypeScript host. The private workbench uses loopback FastAPI/Pydantic and SQLite. A pure JavaScript command engine is shared between synthetic browser mode and the local service; Python independently validates scalar anchors and lineage before persistence.

The local service invokes that engine through a bounded local Node stdin/stdout bridge. Text is not placed in shell arguments or sent to a model. Document this choice and evaluate it against measured maintenance/performance needs before replacing it with a second divergent implementation.

## Private and public capabilities

Private mode can access the local project database and approved private artifacts. Public mode is a synthetic browser demonstration. Do not accidentally enable private import, source retrieval or a developer-loopback rewrite in production hosting.

Use explicit capability responses and origin/host checks. Bind local processes to loopback by default. A public page cannot promise to process private books simply because a local developer has a backend installed. Service errors should remain errors, not silently create another empty project in a different storage mode.

## Database responsibilities

Use relational rows and foreign keys for actual relationships: source spans, revision lineage, evidence bundles, evidence links, memberships, conceptual hierarchy and manuscript references. JSON is appropriate for structured editor payloads, configuration and some metadata, not as the only representation of every edge.

Keep immutable text revisions and exact source spans protected. Reviews/events are append-only; assessments can change state with traceable reasons. Introduce revisioned evidence-assessment records where mutable active link payloads currently leave historical detail available only through snapshots.

Reserved embedding, analysis-run, job, ranking and manuscript tables are not proof of their runtime implementation. Migrations should add real columns/constraints and backfill only what can be established from existing data.

## Snapshot and artifact strategy

Versioned workspace snapshots support recovery and conflict investigation. They should not become an unbounded duplicate of an entire private corpus on every keystroke. As real corpus size grows, move toward normalized immutable source/artifact references, bounded checkpoints and explicit retention policy.

Store large vectors, fitted PCA arrays and analysis artifacts privately with hashes and typed metadata. Keep full float32 vectors available. An index or normalized matrix is derived and reproducible; it is not a reason to discard originals.

Backups need a tested restore procedure. A snapshot is useful only if its source/artifact references can still be resolved. Include schema/configuration versions and verify hashes during restore.

## API contracts

Use typed commands with operation identity, expected workspace/version, exact entity/revision targets and bounded payloads. Separate reads from mutation commands. Return useful errors for stale writes, invalid anchors, unsupported operations, locked entities and missing capabilities.

A retry after an uncertain response should not create duplicate revisions. Preserve operation identity and make its persisted result inspectable. The system can provide idempotent persistence without promising exactly-once external billing.

Define import inspection/approval, source lookup, search, projection/cluster run retrieval, job cancellation and export APIs as separate capabilities. Do not expose a generic arbitrary Python execution or shell endpoint to support analysis.

## Migration discipline

Assign ordered migrations and record which are applied. Test upgrades from the existing five-passage fixture database and from edited/locked workspaces. A new fixture release is distinct from a database schema migration and a user workspace version.

Do not reset user data to install better examples. Preserve logical IDs, old revisions, manual links and rejected suggestions. If a migration cannot map a field reliably, mark it unresolved and retain the original. An approved assessment must not migrate to changed text without review.

A migration failure should leave a recoverable database and a useful report. Avoid partially applied structural changes with no recorded version. Back up before destructive transformations, and distinguish task-owned temporary test data from the user’s project.

## Import and request security

Reject private storage roots inside published source/assets. Bound JSON/archive/file sizes. Sanitize imported markup, disable active content, prevent archive traversal and do not fetch arbitrary remote resources from imported text.

Keep API keys server-side and out of logs, client bundles and tracked configuration. Treat book text and model outputs as untrusted data, not instructions that can authorize filesystem/network operations.

Local origin/host protections are part of the boundary, but do not claim that “local” means no external processing. Every model adapter must pass through the explicit consent/budget layer.

## Operational checks

Test database reopen, interrupted commands, stale tabs, corrupt source hashes, missing artifacts, invalid graph edges, migration replay and recovery from the preceding schema. Confirm public builds return no private source API and make no hidden loopback requests.

Frontend verification still includes TypeScript and a production build after relevant changes. Browser hot reload does not prove that the public build has the intended private/public capability boundary.

## Completion gate

The local service preserves user work across restarts and upgrades, enforces provenance invariants, exposes only the intended bounded API and keeps private material out of public hosting. A later developer can identify schema, fixture, workspace and analysis-run versions independently.
