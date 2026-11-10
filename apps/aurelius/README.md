# Aurelius — source-linked editorial workbench

A source-linked editorial workbench for reconstructing Meditations. The user-supplied Gregory Hays text is privately parsed; the hosted default is a clearly labeled Meric Casaubon backup study with an actual multi-passage synthesis. Real full-corpus embeddings and PCA are complete for all 488 Hays and 418 Casaubon sections, in separate indexes. The one-off production executor is disabled after that authorized run. This is a working editorial slice, not a finished manuscript.

From the repository root, with the existing Node/npm dependencies installed:

```sh
npm ci
npm run aurelius:dev
```

Open **http://127.0.0.1:3150/stoicism**. The launcher uses [uv](https://docs.astral.sh/uv/getting-started/installation/) to create a local Python 3.12 environment from the hash-locked requirements when needed. FastAPI binds to 127.0.0.1:8766; Next binds to 127.0.0.1:3150. Keep these services private. The launcher's `AURELIUS_UI_PORT` and `AURELIUS_API_PORT` can select other distinct loopback ports.

The private database is `.aurelius/aurelius.sqlite3`. Books belong under `.aurelius/imports/`; extracted full text and private exports must also remain inside ignored storage. The numbered plain-text importer is implemented; EPUB/PDF import is future work. `config.example.json` records disabled-by-default processing. The explicit CLI can run approved cached embeddings; ordinary setup, editing and tests need no credentials or paid API calls.

The regular site build serves a browser-only, four-passage Casaubon study with three current teachings and a retained previous proposal with IndexedDB persistence; the original synthetic demonstration remains at `?corpus=demo`. It has no private API proxy and cannot import a private book. The local service does not silently fall back to browser storage after a connection failure. SQLite commits commands with optimistic concurrency, relational provenance tables, immutable source/revision records and versioned recovery snapshots. One local Node command engine is shared with the browser demo; Python independently checks exact scalar anchors and derivation order. Node receives text over a private stdin pipe, never shell arguments.

## First demonstration

1. For the original fixture, open `?corpus=demo` (or the default synthetic local workspace) and select “A pause is not surrender.” Demo A.1 and B.2 support it jointly; C.3 qualifies it. These are separately located original fixture passages, not quotations from Marcus.
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

The supplied Hays OCR is parsed, with provenance and a private inspection report. Rights/processing notes, segmentation approval and external-processing approval/budget remain explicit gates. The checked Kobo EPUB3 is Adobe-DRM restricted; a purchase does not establish importability. No purchase or DRM removal is automated. Before any real source is sent to OpenAI, obtain separate explicit processing consent, credentials and a bounded budget. Do not infer runtime model access from the Codex session.

Detailed planning dossier: [plan/stoicism](../../plan/stoicism/README.md), including visible source/target gradients, substantive content, PCA/clusters and non-destructive workspace upgrades.

## Hosted initial discovery

The preserved synthetic workspace includes nine original teaching studies, visible source/meaning gradients and a PCA/cluster explorer covering all 29 demonstration chunks. Open `/stoicism?corpus=demo#discovery` for that explicitly synthetic map. Existing saved projects receive additive examples without resetting user edits.

`npm run aurelius:analysis` reproduces the actual local PCA/full-space clustering artifact; numerical dependencies are hash-locked. Public demonstration inputs are explicitly local word/bigram TF-IDF features, not OpenAI embeddings. The full modern translation is not silently replaced by these examples. A build fails if the checked-in projection no longer covers every chunk revision.

## Real extraction, synthesis study and immutable embeddings

The user-supplied Hays OCR is now privately parsed into **488** numbered passages. The separately selected [Project Gutenberg 2680](https://www.gutenberg.org/ebooks/2680) backup is **Meric Casaubon**, not Hays, and parses into **418** edition-specific passages. These counts are observations of the supplied files, not hard-coded parser assumptions. The extractor handles the actual line, inline and damaged numbering forms, records each recognition decision, excludes introductions/notes/appendices, and preserves unmodified source text with scalar offsets and hashes. Unknown or duplicate/missing labels are reported; no fixed-size chunking or OCR correction is performed.

The hosted default is a three-passage Casaubon editorial study with a synthesized decision rule, three extracted premises, an explicit inferential bridge, qualifications and a separately editable formulation. This hand-authored proposal is labeled and unapproved. Original synthetic projects remain available at `/stoicism?corpus=demo` in their original IndexedDB database. Private Hays text is never bundled or exported by the public page.

From the repo root, after supplying a text file inside ignored `.aurelius/imports/`:

```sh
npm run aurelius:corpus -- import --source .aurelius/imports/meditations-archive-hays-ocr.txt --edition hays
# Use the exact directory returned by import, here represented by IMPORT_DIR.
npm run aurelius:corpus -- preview --corpus-dir IMPORT_DIR
npm run aurelius:corpus -- study --corpus-dir IMPORT_DIR
```

Inspect `IMPORT_DIR/inspection.json` and compare canonical source spans with `source.txt`. To open the real source editor without paid processing:

```sh
AURELIUS_DATA_DIR=.aurelius/workspaces/hays \
AURELIUS_WORKSPACE_FILE=IMPORT_DIR/workspace.json npm run aurelius:dev
```

Import/source text stays private; a new workspace does not replace your synthetic database. The study's interpretation remains subject to review. Its premise links, exact target mappings, revision invalidation, rejection and locks use the same command engine as the existing editor.

The following is an **operator-approved paid action**, not part of ordinary setup/tests. Set `OPENAI_API_KEY` in the server environment or ignored `.env.local`, without a `NEXT_PUBLIC_` prefix. Never paste it in chat. Use the exact corpus hash and token estimate returned by preview, with explicitly authorized token/USD caps:

```sh
npm run aurelius:corpus -- embed --corpus-dir IMPORT_DIR \
  --review-import --allow-openai --corpus-hash HASH_FROM_PREVIEW \
  --token-budget APPROVED_TOKEN_CAP --cost-budget-usd APPROVED_USD_CAP
npm run aurelius:corpus -- project --corpus-dir IMPORT_DIR
npm run aurelius:corpus -- export-map --corpus-dir IMPORT_DIR
```

The SDK has automatic retries disabled; the job reserves budget before each bounded attempt, retries rate limits at most twice, persists successes and records uncertain billing after connection/server failures. Cancellation stops between requests. No source input is silently truncated. Full float32 vectors live in private SQLite and are immutable. Keys include exact input and full configuration: OpenAI `text-embedding-3-large`, **3072** dimensions, identity normalization and encoding. Changing a teaching does not affect source vectors; changing exact source text creates a distinct vector. Re-running unchanged input after restart makes zero requests. Updating a PCA view/cluster cut never calls an embedding API.

PCA is fitted to all complete real vectors; average-linkage cosine clustering uses the full 3072-dimensional space. An incomplete cache yields an explicit error, with no lexical fallback. `export-map` publishes references/hashes/coordinates only, excluding modern source text and full vectors. The next frontend build verifies real-map coverage and configuration. Both `real-map.json` and `backup-map.json` now contain complete real projections. Open `/stoicism#discovery` for Hays or `/stoicism?map=backup#discovery` for the separate Casaubon map. The source translation and full vector arrays remain private.

Model/limit/price references checked 2026-11-10: [OpenAI embeddings guide](https://developers.openai.com/api/docs/guides/embeddings), [create embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create), [model pricing](https://developers.openai.com/api/docs/models/text-embedding-3-large). Conservative limits are 8191 tokens per input, 32 inputs/16000 tokens per batch, below the documented API maxima. Preview shows estimated costs; the audit stores observed usage separately. Tokenizer assets are downloaded once by tiktoken; tests use mocked model adapters, with no credentials or paid requests.

## Production processing

The ilyadays production deployment supports fresh Vercel OIDC authentication through AI Gateway, so a local OpenAI key is not needed for that path. Read-only `/api/aurelius/production` checks are restricted to the protected immutable Vercel deployment hostname; the public custom-domain route returns 404. A positive Gateway free-credit balance does **not** prove model eligibility. The earlier Gateway requests failed with the provider's explicit free-tier restriction. The completed job uses a sensitive production-only OpenAI key through the explicit direct adapter. No credit purchase was automated and the key was not copied into local env files or reports.

`scripts/aurelius-production-manifest.py` prepares a hash-only allowlist for the exact inspected source inputs. Production POST batches accept only that manifest and its known text hashes, with fixed model/dimensions, source-size/token limits and a bounded expiry. The one-off executor is disabled after completing the authorized job. Native deployment protection must remain enabled (`all_except_custom_domains`); no public paid-inference endpoint is provided.

For an operator-authorized Gateway run, the transport is `gateway-azure` (the same OpenAI text-embedding-3-large hosted through the catalog's Azure endpoint); `--transport direct-openai` selects an OPENAI_API_KEY stored in production, without copying it locally. Prepare and deploy the selected manifest before using `embed-production`. Temporary deployment access is obtained through the connected Vercel tool and stored only under ignored private storage, never in a command argument or repository file.

```sh
npm run aurelius:corpus -- embed-production --corpus-dir IMPORT_DIR \
  --deployment-url https://EXACT-PROTECTED-DEPLOYMENT.vercel.app \
  --access-file .aurelius/production-access.json \
  --review-import --allow-openai --corpus-hash HASH_FROM_PREVIEW \
  --token-budget APPROVED_TOKEN_CAP --cost-budget-usd APPROVED_USD_CAP
npm run aurelius:corpus -- project --production --corpus-dir IMPORT_DIR
```

The two source corpora share the stated $0.10 combined envelope, with at most $0.05 per corpus. Changing hosting transport does not reset the per-corpus reservation ledger. Exact-input cache keys include the selected endpoint/routing configuration; vectors are immutable. Authentication remains server-side. Direct-key production mode uses the same full OpenAI model and no Gateway model fallback. After completing a one-off job, disable its manifest and remove temporary local deployment access. Publish only reference/coordinate artifacts; full modern text and vectors stay private.

### Manual argument annotations

Open **Annotations**, or select exact source text and use **Annotate this piece**. The editable aurelius-annotations-v1 JSON sidecar marks source pieces, speakers, relations and joint premises without editing the translation. Validate exact anchors before saving/exporting. Each save is an immutable proposed revision and makes affected support stale; evidence links and human approvals are not manufactured. See [the language specification](../../docs/aurelius/annotation-language.md). Native inline role editing and automated extraction are later increments.

### Completed real-source run · 2026-11-11

- Hays: 488 × 3,072 cached float32 vectors; PCA run source-pca-9ba05533297a2777.
- Casaubon: 418 × 3,072 cached float32 vectors; PCA run source-pca-eb142833b8e73ff4.
- 30 successful production requests; 122,089 observed input tokens; $0.01587157 calculated from observed usage and the listed price, within the approved $0.10 cap.
- Restart made zero embedding requests and preserved every full-matrix hash. Redrawing/reclustering never re-embeds source text.
- PC1+PC2 retain 8.040857% / 9.515743% of variance; clustering uses the full 3,072 dimensions. Numerical checks verify the saved transforms, variance and a full-space cluster cut.

Full private data lives under ignored .aurelius/. Only references, hashes, projection coordinates and numerical metadata are published. The hosted Hays map cannot display private full-source text; the backup’s selected source passages link to the editorial workbench. Remaining synthesis/ontology/manuscript stages still need their own implementation and review.
