# Aurelius — Stage 0 / Stage 1

A source-linked editorial workbench for reconstructing Meditations. The current corpus is explicitly synthetic, not Hays or another translation. This is the first provenance slice, not full-corpus analysis or a finished manuscript.

From the repository root, with the existing Node/npm dependencies installed:

```sh
npm ci
npm run aurelius:dev
```

Open **http://127.0.0.1:3150/stoicism**. The launcher uses [uv](https://docs.astral.sh/uv/getting-started/installation/) to create a local Python 3.12 environment from the hash-locked requirements when needed. FastAPI binds to 127.0.0.1:8766; Next binds to 127.0.0.1:3150. Keep these services private. The launcher's `AURELIUS_UI_PORT` and `AURELIUS_API_PORT` can select other distinct loopback ports.

The private database is `.aurelius/aurelius.sqlite3`. Books belong under `.aurelius/imports/`; extracted full text and private exports must also remain inside ignored storage. No real-book importer is implemented yet. `config.example.json` records the selected edition, fixed embedding configuration and external processing/budget boundary; it is a future adapter specification, not an enabled runtime client. No credentials or external API calls are needed for this slice.

The regular site build serves the same page as a browser-only synthetic demonstration with IndexedDB persistence. It has no private API proxy and cannot import a book. The local service does not silently fall back to browser storage after a connection failure. SQLite commits commands with optimistic concurrency, relational provenance tables, immutable source/revision records and versioned recovery snapshots. One local Node command engine is shared with the browser demo; Python independently checks exact scalar anchors and derivation order. Node receives text over a private stdin pipe, never shell arguments.

## First demonstration

1. Open the default teaching. Demo A.1 and B.2 support it jointly; C.3 qualifies it. These are separately located original fixture passages, not quotations from Marcus.
2. Click an excerpt or evidence reference to inspect it in full context. Select new source text, give a relation/justification and attach it to the meaning.
3. Review the three links, write a review note and approve the meaning. Scope, qualifications and the joint-premise explanation are required. Concept tags do not count as support.
4. Open the expression pane. The reflective wording is a separate revision with clause-level mappings. The alternate “Deliberate overreach” contains an unsupported universal promise; approval is blocked.
5. Edit/save the meaning. Its new revision and copied evidence are stale. Previous wording and review remain in history; the dependent expression becomes stale. Reload to verify persistence.
6. In the expression pane, select an exact clause and choose “Map selected clause” to propose a mapping to the selected meaning. Changed paragraphs lose provenance marks rather than attributing new words automatically. Re-review meaning and wording independently.

Locks, pin/exclude preferences, literal/reference search, independent pane scrolling, keyboard resizing, source/theme/plain modes, manual teachings and archived link deletion are available. Source/theme colors are separate; gradients represent contributor sets, never contribution percentages. The normal editor renders only the selected neighborhood and visible anchors.

## Tests

Install the browser runtime once if it is not already present:

```sh
apps/aurelius/.venv/bin/python -m playwright install chromium
npm run test:aurelius
```

This one test command runs pure command/anchoring tests, FastAPI/SQLite integration tests and browser tests against isolated temporary data on 3152/8767. It does not reset your workspace or stop unrelated processes. `npm test` also includes the pure domain tests. Repository frontend release checks remain `npm run typecheck`, `npm run lint` and `npm run build`.

## Continuity

- [Architecture](../../docs/aurelius/architecture.md)
- [Data model and provenance invariants](../../docs/aurelius/data-model.md)
- [Acquisition and import requirements](../../docs/aurelius/acquisition.md)
- [Ordered backlog](../../docs/aurelius/backlog.md)
- [Editorial rubric](../../docs/aurelius/editorial-rubric.md)
- [Implementation log / next executable step](../../docs/aurelius/implementation-log.md)

Stage 2 requires an authorized text-readable Hays file, rights/processing notes and segmentation approval. The checked Kobo EPUB3 is Adobe-DRM restricted; a purchase does not establish importability. No purchase or DRM removal is automated. Before any real source is sent to OpenAI, obtain separate explicit processing consent, credentials and a bounded budget. Do not infer runtime model access from the Codex session.

Detailed planning dossier: [plan/stoicism](../../plan/stoicism/README.md), including visible source/target gradients, substantive content, PCA/clusters and non-destructive workspace upgrades.

## Hosted initial discovery

The hosted workbench includes nine original teaching studies, visible source/meaning gradients and a PCA/cluster explorer covering all 29 current canonical demonstration chunks. Open `/stoicism#discovery` for the map. Existing saved projects receive additive examples without resetting user edits.

`npm run aurelius:analysis` reproduces the actual local PCA/full-space clustering artifact; numerical dependencies are hash-locked. Public demonstration inputs are explicitly local word/bigram TF-IDF features, not OpenAI embeddings. The full modern translation is not silently replaced by these examples. A build fails if the checked-in projection no longer covers every chunk revision.
