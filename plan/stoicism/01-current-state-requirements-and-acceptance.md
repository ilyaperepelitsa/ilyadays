# Current state, requirements and acceptance matrix

## Inspection baseline

The inspected implementation is commit `f67b8fb3a2bf6b0c498e0ab91299f8441748b242`. Verify the current checkout before using line-level assumptions in an implementation session. This document records a baseline, not an assertion that the repository will remain at that commit.

Existing code lives in `src/components/aurelius/`, `src/lib/aurelius/`, `apps/aurelius/`, `content/aurelius/` and `docs/aurelius/`. The public route is `/stoicism`, with a Russian entry route. The private launcher starts a loopback Next/FastAPI workspace; the hosted page uses synthetic IndexedDB storage.

## What is genuinely present

| Area | Existing foundation | Important limit |
|---|---|---|
| Source anchors | Scalar offsets, exact text, context, hashes and revision IDs | No real Hays import yet |
| Source display | Highlighted source spans and focused connectors | Highlights are subtle; overlapping contributor sets collapse to one preferred span |
| Meaning editing | Editable conclusion, scope, practical implication, qualifications and assumptions | Default meaning text has no adequate inline source coloring |
| Expression | Optional pane with grounding marks and an unsupported variant | Most visible target provenance is hidden behind opening this pane |
| Revisions | Immutable text revisions, copied stale support and dependent invalidation | Historical evidence comparison is incomplete in the UI |
| Evidence | Many-to-one stored links, relation edits, review and archival removal | Clause-level meaning mappings need stronger representation |
| Concepts | Two fixture concepts and topical memberships | No implemented concept discovery or ontology editor |
| Map | No PCA or cluster explorer | Reserved analysis tables are not a working map |
| Content | Five synthetic passages, one conclusion and two formulations | Does not demonstrate a broad or substantial reconstruction |
| Persistence | SQLite privately; IndexedDB in public fixture mode | Seed upgrades do not currently solve every old-workspace migration concern |
| Runtime inference | Disabled; specification/configuration artifacts exist | No live embeddings, extraction, synthesis or critique jobs |

## Requirement priorities

Use priority P0 for correctness and boundaries, P1 for the immediate requested experience, P2 for necessary completion of the research workflow, and P3 for later enhancements whose omission does not corrupt the current result.

| ID | Requirement | Priority | Observable acceptance |
|---|---|---|---|
| PROV-001 | Exact source anchors remain valid | P0 | Invented, ambiguous or changed-source references fail validation |
| PROV-002 | Meaning edits invalidate affected support | P0 | A new revision is visibly stale; prior approval stays with the prior revision |
| PROV-003 | Theme membership is not support | P0 | Adding a concept never creates an evidence link or approval |
| VIS-001 | Left text visibly shows provenance | P1 | Default view contains readable highlights and discoverable inspectors |
| VIS-002 | Right meaning text shows contributors | P1 | Source colors are visible without enabling the expression pane |
| VIS-003 | Genuine overlap can show several contributors | P1 | One stored overlapping range produces the expected contributor set |
| VIS-004 | Unsupported additions are distinct | P0 | Unmapped prose receives no convincing source gradient |
| CONTENT-001 | More than one worthwhile teaching | P1 | Several substantially different teachings can be selected and compared |
| CONTENT-002 | Limits and conflicts survive concentration | P0 | Counterexamples and qualifications are present in accepted evidence bundles |
| MAP-001 | PCA coordinates come from a fit | P1 | A run records inputs, preprocessing, components and explained variance |
| MAP-002 | Clusters are computed in the declared space | P0 | The 2D chart is never silently used as authoritative clustering input |
| MAP-003 | Map/list/editor selections are linked | P1 | Selecting a point opens its exact source and associated review context |
| IMPORT-001 | Selected translation remains Hays | P0 | Synthetic mode cannot silently become a different production translation |
| IMPORT-002 | Canonical sections remain accessible | P0 | Every imported author passage can be located outside useful clusters |
| MODEL-001 | External source processing is gated | P0 | No outbound source request occurs without explicit consent and budget |
| RETR-001 | Retrieval exists independently of clustering | P2 | Literal and exact-reference lookup work before concepts exist |
| SYN-001 | Core conclusions require human review | P0 | A job cannot approve its own output |
| BOOK-001 | Manuscript clauses preserve lineage | P2 | Final prose resolves to reviewed conclusions and exact source spans |

## Acceptance scenarios for the current complaints

### Visible source and target colors

Open a teaching with three contributing excerpts. The source texts show S1, S2 and S3 using the same palette used by the meaning clauses they support. One clause supported jointly by S1 and S2 shows both. Another clause limited by S3 identifies that relation explicitly. Keyboard focus reveals the same inspector as pointer interaction. Plain mode removes color while retaining the references.

This scenario fails if only the expression variant is colored, if arrows are the only provenance indicator, or if all words inherit every color because the teaching has three evidence links somewhere.

### A meaningful content demonstration

Open a gallery or teaching navigator containing several distinct topics and tensions. Select a teaching about social responsibility, one about judgment, and one about mortality. Each has scope, qualifications and an explanation of what its evidence establishes. At least one nearby statement is rejected for overreach and at least one unresolved tension stays visible.

The scenario is explicitly synthetic until the selected modern edition has been imported. It fails if the demo becomes a set of unattributed motivational slogans or if original fixture prose is displayed as translated Marcus.

### Actual PCA and clustering

Open discovery. The screen identifies corpus mode, vector origin, input count, dimensions, run ID, PC1/PC2 explained variance and clustering space. Change the cluster cut and observe labels derived from the stored hierarchy. Select a point and inspect the exact associated passage. Compare map proximity with a full-vector neighbor list.

This scenario fails if coordinates are hand drawn, the legend suggests cluster membership proves support, or a fixture run is labeled as OpenAI/real-corpus analysis.

## Acceptance must distinguish appearance from truth

Software tests can establish that a displayed citation resolves to the exact stored substring. They cannot establish that the substring philosophically entails the highlighted claim. Maintain separate results for anchor validity, evidence review, fidelity, retrieval recall and visual behavior.

A release may pass numerical PCA checks and still have unhelpful clusters. It may pass visual checks and still overgeneralize a passage. Those failures need separate issue records and separate corrective work.

## Existing-workspace acceptance

Do not test only a fresh browser. Load the old five-passage demo, add a user teaching, change an evidence relation, lock a decision, then upgrade the application. The new demonstration material and discovery controls should become available without erasing the user work or silently changing reviewed revisions.

An explicit reset may remain available, but it must not be the ordinary migration strategy. Store the fixture revision separately from schema and workspace versions. If an upgrade cannot be applied safely, report the conflict and preserve a recovery export.

## Sign-off record

For each requirement, record status as planned, implemented, mechanically checked, human reviewed or blocked. Include an evidence path or test name. Do not mark all requirements done because the page returned HTTP 200. The acceptance matrix is the project’s completion ledger, not a decorative feature list.

## Implementation update after the inspection baseline

The initial discovery release adds 29 synthetic chunks, nine teachings, stored meaning-clause mappings, visible source/target gradients and an actual all-chunk PCA/full-space clustering explorer. Additive upgrades preserve saved editorial data. These changes supersede the baseline gaps only for the explicitly synthetic demonstration. Authorized real-corpus import, fixed-model source embeddings, automated synthesis and manuscript completion remain separate requirements. See docs/aurelius/implementation-log.md for release behavior and verification evidence.
