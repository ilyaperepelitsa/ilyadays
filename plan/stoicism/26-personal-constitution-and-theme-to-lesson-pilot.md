# Personal constitution: chapters, lessons, reasons and voice

## Delivery decision, 2026-11-11

The target is an organized personal book: opening principles, broad chapters, narrower lessons, explanations and applications. A computational cluster is a retrieval neighborhood, not a chapter or a justified conclusion. Six clusters is not an editorial requirement. The UI now begins at the top split and lets the reader move a distance cut across stored merge heights. Complete linkage is the initial exploratory view; average remains an inspectable baseline.

Existing vectors remain unchanged. Sliding the dendrogram changes a partition, not the vectors, PCA fit, source text or evidence links. Complete linkage does not establish philosophical themes. Cosine silhouette measures geometric separation, not fidelity, coherence or manuscript quality. Existing weak scores and the dominant average-linkage group remain visible.

## Three distinct structures

1. **Computational hierarchy:** stored leaves, binary merges and distances. A cut produces disjoint groups; tied heights merge together. PCA cannot be the authority for grouping.
2. **Curated themes:** definitions, inclusion/exclusion criteria, many-to-many passage/proposition memberships, and a multiple-parent DAG. A passage can address judgment, bodily feeling and adversity. Membership and evidential support require separate review.
3. **Editorial book:** ordered chapters reference lessons. Each lesson has a precise conclusion, author-given reasons, editorial bridges, conditions, limits and formulation variants. Repeated placement preserves a lesson's identity. Different lessons can use the same source for different claims.

The pilot persists immutable `manuscript_revisions`, a current pointer, stable chapter IDs, ordered placements, and exact conclusion/expression revisions. SQLite migration 006 records relational lesson references. Editing a meaning or expression does not silently rewrite the book: its older revision remains visible until deliberately refreshed. Saving or rearranging a manuscript never approves its teachings.

## Small real-text demonstration

The public Casaubon study adds four inspected passages to the existing four. It remains a small manual pilot. Hays stays the primary private edition with its existing studies; Casaubon references are not silently copied into Hays.

| Chapter | Lesson | Evidence | Preserved qualification |
|---|---|---|---|
| Judgment and attention | Examine an ordinary impression | Casaubon 8.12 and 9.13 | Examination is qualified by “if possible”; distinguishing judgment from things does not establish which judgment is correct. |
| Judgment and attention | When an impression brings distress or threat | Casaubon 8.12, 5.16 and 5.20 | Applying examination to threat is an editorial bridge. Bodily feeling is acknowledged; distress is not declared voluntary. |
| Action in difficult encounters | Distress; non-imitation | Separate bundles | Shared chapter membership does not make the vine, revenge and hive reminders one argument. |
| Our shared life | Cooperation without a debt; part and shared good | Existing studies | Functional social nature and the hive analogy retain their separate premises and limits. |

Casaubon 8.12 contributes to two lessons; several passages have attention/adversity memberships. This proves overlap without making a clustering algorithm decide meaning. The reader can rename, add and reorder chapters, reorder lessons, include a lesson in several chapters, inspect exact excerpts and open the source/meaning editor. Source-colored clauses render stored provenance, not invented word attribution.

## Voice with conviction and inspectable limits

Use firm second-person language for the reader-facing variant, independently editable and reviewable. “When you can, examine what appears before you” is editorial wording, not an invented Marcus quotation. A chapter can carry conviction without claiming divine authority or deleting source conditions.

Every lesson separates what to do, why Marcus gives the direction, what connection the editor added, when it applies, where evidence stops, and which source contributes to each clause. Preserve actual arguments, premises, analogies, objections, or the absence of a stated reason. Resonance, clarity and fidelity remain different review dimensions. Changing voice cannot strengthen “sometimes” into “always” or turn a philosophical premise into a guarantee that pain disappears.

## Next experiment before scaling

1. Ask for editorial review of the two judgment lessons and their contrast. Check the prose's voice and usefulness before full coverage.
2. Propose three to five theme definitions with representative, borderline and conflicting examples. Keep same-topic disagreements without merging claims.
3. Prepare a user-launched pilot of 12–20 selected passages with item, token, cost and repair limits. Extract propositions before assigning themes or drafting lessons. A span can belong to several themes.
4. Evaluate retrieval, membership and support separately. Include ordinary impressions, threat, pain, disagreement and an unrelated reminder. A clean plot is not an acceptance test.
5. After review, expose corpus synthesis as a user-run resumable command with per-item tqdm progress. The existing shell runner orchestrates local stages; it does **not** implement synthesis.

Twenty sources is an example, not a lesson quota. Preserve singletons and unresolved ideas. Do not require a complete taxonomy before delivering another useful lesson.

## Comparative corpora

Use [constitutional research](25-constitutional-structure-and-comparison-corpora.md) for form: preamble, principles, provisions, limits and amendment. Keep external corpora in separately typed collections with rights, source units and input manifests. They may inform organization, never become unstated premises attributed to Marcus.

No constitution corpus with verified full `text-embedding-3-large` vectors was established in the bounded search. A same-model scripture collection was found, but generated chapter context changes its input recipe. Do not pool those vectors with bare Meditations passages as a neutral philosophical taxonomy. If comparison is useful, first embed a small reviewed article-level sample with the same explicit recipe and a separate budget.

## Delegation and remaining work

Follow [the delivery policy](24-delivery-delegation-and-user-run-batches.md): Luna for bounded inventory/research and mechanical tests; Terra for small implementation surfaces; primary agent for integration and semantic/provenance review. The user launches long corpus jobs. Deliver a usable pilot, verify it, and release without waiting for a coverage run.

Remaining work includes synthesis adapters/CLI jobs, user-defined theme editing, reviewed retrieval evaluation, coverage, ranking, and provenance-preserving manuscript exports. The outline pilot does not claim these complete.
