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
