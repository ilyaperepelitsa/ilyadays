# Provenance schema and version boundaries

The active Stage 1 SQLite schema is `apps/aurelius/migrations/001_provenance.sql`; API envelopes and exact source objects are Pydantic models. Editorial transitions are enforced by `src/lib/aurelius/domain.mjs` and the same engine runs behind the local API. Reserved future-stage tables are empty: their existence is not a claim that analysis or manuscript generation is implemented.

| Entity | Versioned information / relation |
|---|---|
| Edition | Work, translator, publisher, edition, ISBN, acquisition/source URL, actual format/access/importability, rights assumptions, file hash, parser version. Acquisition metadata may be unknown; never fabricate a file hash. |
| Passage revision | Edition ID, stable passage ID, edition-specific book/section, locator, immutable raw/text strings, SHA-256, normalization version. Future normalized text requires an explicit offset map back to raw. |
| Source span | Immutable passage revision, Unicode scalar [start,end), exact substring, prefix/suffix, hash, validation status. |
| Proposition (Stage 4) | Immutable claim revision, source span IDs, assertion kind, scope, modality, exclusions, interpretive/review state. |
| Concept / revision | Name/definition, inclusion/exclusion, parents, revision history. Parent DAG is independent of derivation. Ontology editing is Stage 3. |
| Membership | Passage/proposition + concept, provisional relevance/rationale, review state. Many-to-many; never an evidence link. |
| Conclusion revision | Stable entity ID, immutable text/editor doc, practical implication, scope, qualifications, bridge assumptions, interpretation type and evidence bundle. Assessment is separate from immutable text. |
| Evidence bundle | Target revision, joint/independent mode, concise explanation of premises and limits. Links reference the bundle explicitly. |
| Evidence link | Source span, target revision, relation, justification, reviewer/review state, active/archive state. No line is created solely for display. |
| Expression revision | Reader-facing editor doc with stable block IDs, explicit grounding marks over clauses and referenced conclusion revisions. Variant entities remain separate; assessments/review history never transfer silently. |
| Clause mapping | Stored Tiptap mark identifies the exact marked text within a stable block and immutable expression revision, conclusion revision and contributing span IDs. The mark defines its range through editor transactions, not a guessed character-to-source allocation. |
| Assessment/review/event | Revision, state/decision, concise note/justification, reviewer, timestamp, command ID and ordered snapshot version. Rejected historical formulations remain inspectable. |
| Manuscript (Stage 6) | Stable principle/block IDs, hierarchical sections, order, referenced expression revisions and editorial version. |
| Embedding (Stage 2) | Complete input/config hashes, typed entity revision, model, 3072 dimensions, full float32 vector, normalization version, request metadata, created timestamp. |
| Analysis run (Stage 3+) | Input revision/config hashes, fitted projection/cluster parameters, outputs, algorithm version; computational proposals are distinct from curated concepts. |
| Ranking (Stage 6) | Per-dimension anchored ordinal score, missing ratings, rationale, rubric version, assessor/review date, profile weights and evidence eligibility. No fabricated personal resonance. |
| Job/model run (Stage 4/7) | Input/prompt/schema versions, configuration and exact returned model ID, token/cost reservations and observations, checkpoints, outputs, cancellation, bounded repair/retry and unknown-outcome history. |

Relations: supports, qualifies, challenges, illustrates, depends_on, paraphrases, editorial_extrapolation. Interpretations: direct_statement, close_paraphrase, multi_passage_synthesis, editorial_inference, modern_application. A close paraphrase still needs semantic review; an exact quotation needs mechanical anchor validation as well.

Immutable revision ordering provides an acyclic derivation order. Model-generated span proposals must be located and validated by code. Repeated matches without distinguishing context fail. Character boundaries that split a UTF-16 surrogate pair fail; combining marks remain separate scalars. The Python and browser conversion tests use identical edge cases.

Stage 1 exports a clearly labeled synthetic project with edition IDs, reviews, links and revision IDs. It is not a manuscript exporter. Later shareable exports must exclude source full text and include rights-review flags, provenance appendix and a machine-readable edition/model/run manifest.
