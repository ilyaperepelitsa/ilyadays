# Aurelius — architecture decisions (Stage 0)

## Scope and product

An editorial reconstruction from Meditations, not a new book by Marcus or an authoritative account of Stoicism. Initial delivery is Stage 0 and Stage 1. Stages 2–7 are ordered in backlog.md. No real corpus, paid inference, embeddings, cluster results or scholarly approvals are fabricated.

The existing repository is Next 16 / React 19 / TypeScript / Tailwind 4, with local CSS tokens and Radix controls. Keep these conventions. Add `/stoicism` in English and Russian; source language remains the selected English edition. Use pinned Tiptap 3 with UniqueID for paragraph identity and ProseMirror transaction mapping for editorial decorations. A separate graph explorer is deferred to Stage 3/5; ordinary editing only shows the selected evidence neighborhood.

## Private service and public demonstration

FastAPI, Pydantic and migrated SQLite run on loopback. `npm run aurelius:dev` starts both services on loopback; only this launcher enables a Next development rewrite to the local API. Production has no such proxy. Real books, database, extracted text and private exports live under ignored `.aurelius/`, outside public/. A hosted/browser-only demonstration persists synthetic data in IndexedDB; it cannot import a translation. No cookies or authentication are needed for this single-user local service. Never expose either local process to a public interface.

No OpenAI client is active in Stage 1. There is no source upload or generation endpoint. Source text is untrusted data. A later live adapter needs explicit source-processing consent and budget approval, independently of local import approval. Secrets stay server-side. Source files and their full text must never enter Next route caches, static props, public assets, analytics or logs.

## Provenance invariants

- Source passage revisions are immutable and edition-specific. Raw and normalized text remain separate; Stage 1 normalization is identity-v1.
- Offsets are zero-based Unicode scalar indices, half-open [start,end). Exact substring, prefix/suffix, passage SHA-256 and immutable revision ID validate together. Convert UTF-16 DOM positions explicitly; reject offsets inside surrogate pairs. Never normalize away combining marks.
- Concepts/memberships are separate from evidence. Membership grants no support or approval.
- Evidence links explicitly reference a source span and a target revision. Relation, justification and review state persist. A joint bundle explains how premises work together; no individual arrow claims to prove the entire conclusion.
- A substantive text or meaning-field edit always creates a new revision, even after undo back to earlier wording. Prior reviews stay attached to the prior revision. Candidate links copied to a new revision are stale, and dependent expression reviews become stale. Unreviewed additions receive no provenance decoration.
- Deleting/changing a link or its justification invalidates the target assessment and downstream expression assessments. Deletion archives a link; the review/event log preserves history.
- Derivation edges only point to earlier immutable revisions. Concept parent edges will have their own DAG checks, independent of lineage.
- Locks prevent edits and evidence changes until explicitly unlocked. Concurrency uses an expected workspace version; stale saves fail rather than overwriting.
- Tiptap stores stable paragraph IDs. Provenance marks map with transactions; edits conservatively mark the whole affected assessment stale rather than claiming exact semantic alignment. No word-by-word attribution is inferred.

The pure command engine is shared JavaScript. FastAPI validates Pydantic input, invokes the repository Node runtime through a bounded local stdin/stdout pipe, independently validates Python scalar anchors and lineage, then commits SQLite atomically. No text enters shell arguments, logs or an external service. This avoids duplicate browser/server provenance logic while keeping persistence and future analysis in Python.

SQLite stores immutable revisions, source spans, evidence links/bundles and append-only review/events relationally. Versioned workspace snapshots support recovery and optimistic concurrency. Reserved tables for later propositions, concepts, membership, embedding records, analysis runs, jobs, ranking assessments and manuscripts are distinguished from implemented Stage 1 functionality.

## Verification and boundaries

Test exact/invented/repeated quotes, Unicode conversion, source immutability, joint support, concept/evidence separation, revision invalidation, dependent outputs, locks, restart, concurrent saves and malformed/untrusted input. Browser tests exercise selection in both directions, edits, reload, review, unsupported variants, keyboard resizing, independent scrolling and arrows. Run repository TypeScript, lint and production build. Mock fixtures are original synthetic teaching examples, never quotations from Meditations.

External blockers: an authorized text-readable Hays file and import/segmentation approval; separate source-processing consent, credentials and bounded budget for external inference. No automatic purchases or DRM removal.

Source-linked writing should remain usable before paid inference. The initial API deliberately accepts the checked-in synthetic fixture only; a later authorized-file importer must not reuse the synthetic-only validation bypass. Real EPUB ingestion, archive defenses, model adapters, ontology editing and manuscript export remain separate work items.

## Real source import and vector cache increment

The deterministic plain-text importer stores immutable edition-specific corpora plus source bytes and an offset/segmentation inspection report under ignored `.aurelius/corpora/`. The local service may seed a new dedicated workspace from an explicitly selected private `workspace.json`; existing workspaces remain separate. Real imported corpora skip synthetic fixture upgrades. Hays and the user-selected Casaubon backup retain independent section IDs, editorial links and assessments.

Full OpenAI float32 vectors live in a separate private `embedding-cache.sqlite3`, content-addressed by exact input and the complete fixed configuration. Source-revision associations are many-to-many; identical inputs may reuse a vector, without merging textual identities or independent-evidence judgments. An immutable-vector guard prevents overwriting prior results. Request reservations and observed/uncertain outcomes are durable. This small shared cache is separate from editorial snapshots so conclusion edits and new workspace instances cannot invalidate unchanged source vectors.

The explicit CLI controls paid processing, including the protected production adapter; ordinary browser editing never starts model requests. It verifies the exact imported source ranges, requires exact-corpus/import/external-processing approval and bounded token/USD caps, disables SDK automatic retries and uses the official OpenAI endpoint. It never invokes an unconfigured generation model. The ordinary local browser does not initiate provider calls.

A real projection consumes a complete cached source matrix and records its full configuration and vector/corpus/software identities. A public map export contains references, hashes and coordinates only. Full modern source text and source vectors remain private. The hosted four-passage Casaubon study with three current teachings has its own IndexedDB database; original synthetic projects remain accessible separately. A missing real-map artifact produces an explicit pending/unavailable state rather than a synthetic fallback. Both complete real reference-only artifacts were fitted and exported on 2026-11-11.

## ADR 006 — Completed production embedding boundary

The authorized source job executed through a protected immutable Vercel production deployment with a sensitive production-only OpenAI key. Direct OpenAI access bypasses the earlier Gateway free-tier model restriction without substituting the model. A hash-only source allowlist, fixed model/dimensions, per-request limits, durable local budget reservations and a fixed expiry bound execution. The executor is disabled after completion. Native deployment protection remains enabled and custom-domain paid routes return 404. Full source/vector arrays stay in ignored private storage; public maps contain references and 2D coordinates. The actual full matrices and fitted transforms are audited independently of model mocks.


## ADR: editorial book independent of similarity partitions (2026-11-11)

A distance-cut dendrogram explores the full stored cosine hierarchy, with atomic ties. Complete linkage is the initial exploratory method; average remains visible. Start below the root rather than selecting an arbitrary six groups. A unique display row per visible node prevents label collisions; horizontal positions retain actual merge distances. Computational group membership never changes evidence or theme decisions.

The separate book constructor groups stable lesson entities into ordered, editable chapters, allowing repeated placements. A saved manuscript revision freezes conclusion and expression revisions; saving never approves content. `manuscript` commands pass through the shared browser/SQLite domain validator, optimistic concurrency and immutable history. Migration 006 adds immutable manuscript records and relational lesson references. Source or expression edits leave frozen book wording intact with an explicit older-revision status; refreshing a placement is deliberate and requires review.

The eight-passage public Casaubon pilot demonstrates ordinary judgment versus judgment in distress, shared evidence, independent theme memberships, author-given reasons, editorial bridges and directive variants. Hays remains private and is not relabeled with Casaubon numbering. This is a manually authored pilot, not automated full-corpus coverage.

External constitutions/scripture stay separate from Marcus's evidence. Their registry records source/rights and model/input compatibility; matched dimensions alone are insufficient. Long runs belong to the user-launched shell runner. It orchestrates local stages with tqdm/checkpoints; bounded paid synthesis stages remain to be implemented under explicit budgets.
