# Aurelius — implementation planning dossier

This directory is the detailed execution plan for the source-linked Meditations workbench. It expands the initial design into independently actionable workstreams. It records what the repository actually does, what the current demonstration fails to communicate, and the evidence required before calling a future increment complete.

The immediate product correction is concrete: source provenance should be visibly readable in the left text, the meaning on the right should visibly show its contributors in the default two-pane view, the material should demonstrate substantial philosophical distinctions, and discovery should include a real PCA two-dimensional map with computational cluster proposals. A thin example and subtle underlines do not satisfy that experience.

The public page currently contains synthetic examples. Nothing in this plan converts those examples into Hays quotations or real-corpus analysis. Acquiring an authorized importable edition, approving segmentation, and approving external processing remain separate decisions.

## How to use these plans

Begin with the master plan, the current-state acceptance matrix, the gradient/provenance plan and the PCA plan. Then follow the dependency sequence in the execution backlog. Every substantial workstream specifies data contracts, implementation work, failure cases, checks and a completion gate.

Do not read a checked box as permission to run a paid batch. Do not read an installed package, a reserved database table, a mock screenshot or an existing prompt template as an implemented product capability. Completion requires working behavior against the relevant corpus mode and persistence backend.

| File | Purpose |
|---|---|
| [00-master-plan.md](00-master-plan.md) | Product definition, sequencing, delivery gates and scope boundaries |
| [01-current-state-requirements-and-acceptance.md](01-current-state-requirements-and-acceptance.md) | Repository evidence, current gaps and observable acceptance requirements |
| [02-edition-acquisition-rights-and-privacy.md](02-edition-acquisition-rights-and-privacy.md) | Hays acquisition, actual file restrictions, rights assumptions and consent |
| [03-import-segmentation-and-corpus-inspection.md](03-import-segmentation-and-corpus-inspection.md) | Safe import, canonical sections, extraction reports and human segmentation approval |
| [04-provenance-schema-revisions-and-invalidation.md](04-provenance-schema-revisions-and-invalidation.md) | Exact anchors, immutable revisions, evidence bundles and invalidation |
| [05-source-gradients-and-target-highlights.md](05-source-gradients-and-target-highlights.md) | Visible two-sided provenance, overlap, inspectors, stale and unsupported states |
| [06-editor-workspace-and-interaction-design.md](06-editor-workspace-and-interaction-design.md) | Editing, navigation, selection, compare, graph neighborhoods and draft behavior |
| [07-philosophical-depth-and-content-program.md](07-philosophical-depth-and-content-program.md) | Meaningful material, interpretive distinctions, tensions and fixture expansion |
| [08-embeddings-search-and-retrieval.md](08-embeddings-search-and-retrieval.md) | Fixed 3072-dimensional embeddings, exact search, caching and retrieval evaluation |
| [09-pca-clustering-and-discovery-map.md](09-pca-clustering-and-discovery-map.md) | Actual PCA, full-dimensional clustering, linked map/list views and numerical integrity |
| [10-concepts-overlap-and-ontology.md](10-concepts-overlap-and-ontology.md) | Computational proposals versus curated concepts, overlap and parent DAGs |
| [11-propositions-evidence-and-critical-synthesis.md](11-propositions-evidence-and-critical-synthesis.md) | Claims, evidence assembly, joint inference, critique and approval |
| [12-expression-variants-and-semantic-review.md](12-expression-variants-and-semantic-review.md) | Resonant writing that preserves meaning, clause mappings and semantic changes |
| [13-ranking-rubrics-and-personal-resonance.md](13-ranking-rubrics-and-personal-resonance.md) | Independent importance dimensions, transparent profiles and missing user ratings |
| [14-manuscript-coverage-and-exports.md](14-manuscript-coverage-and-exports.md) | Stable principles, concentrated books, coverage and rights-aware export |
| [15-local-backend-storage-and-migrations.md](15-local-backend-storage-and-migrations.md) | Local service, SQLite, artifact storage, API boundaries and recovery |
| [16-model-adapters-jobs-and-budget-control.md](16-model-adapters-jobs-and-budget-control.md) | Responses API, structured outputs, resumable jobs, consent and costs |
| [17-evaluation-tests-and-quality-gates.md](17-evaluation-tests-and-quality-gates.md) | Software correctness, human fidelity evaluation and end-to-end acceptance |
| [18-accessibility-responsive-design-and-performance.md](18-accessibility-responsive-design-and-performance.md) | Readable dense layouts, accessible provenance/map interactions and performance |
| [19-rollout-migration-and-operations.md](19-rollout-migration-and-operations.md) | Non-destructive upgrades, local/public release differences and operational runbooks |
| [20-executable-backlog-and-session-continuity.md](20-executable-backlog-and-session-continuity.md) | Ordered work packages, dependencies, handoffs and stopping conditions |
| [21-architecture-decisions-and-open-questions.md](21-architecture-decisions-and-open-questions.md) | Accepted decisions, alternatives and genuinely unresolved choices |
| [22-critical-review-perspectives.md](22-critical-review-perspectives.md) | Ten development review perspectives and adversarial scenarios |
| [23-source-registry-and-verification.md](23-source-registry-and-verification.md) | Primary documentation, evidence status and re-verification responsibilities |

## Status vocabulary

- **Existing foundation:** supported by inspected repository code; may still have UX or completeness gaps.
- **Planned correction:** requested behavior that is not currently delivered adequately.
- **Fixture demonstration:** uses original synthetic text or declared synthetic vectors; not evidence about Meditations.
- **Real-corpus blocked:** cannot be represented honestly before the authorized selected edition is available.
- **External processing gated:** requires separate explicit consent and a budget before any source leaves the machine.
- **Acceptance verified:** reserved for a specific implementation with recorded tests and review evidence.

## Authority and continuity

The user brief controls requirements. These plans clarify execution; they do not relax the source, rights, budget, interpretation or approval boundaries. Existing concise records remain in `docs/aurelius/` and setup instructions remain in `apps/aurelius/README.md`. This directory becomes the detailed planning reference; implementation logs should link to completed work-package IDs rather than duplicating whole chapters here.

Keep runtime fixtures in `content/aurelius/`, application code under the existing source/application directories, and private books and outputs under ignored private storage. This folder contains plans and non-private examples only. It must never become an accidental repository of the copyrighted translation.

A useful handoff names the current work package, exact files changed, actual checks run, data/corpus mode, unresolved failures and the next executable step. It must not rely on another session reconstructing the conversation.
