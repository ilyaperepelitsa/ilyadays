# Provenance data, immutable revisions and invalidation

## Fundamental separation

Concept membership says that material is relevant to a subject. Evidence says that a particular source, under an explicit interpretation, supports or limits a particular target claim. The database and UI must never collapse those relationships.

The derivation graph follows immutable revisions and must be acyclic. Concept associations may be reciprocal. Multiple-parent conceptual hierarchy edges form a separate DAG. A cycle in a conceptual association graph is not evidence that the derivation graph may cycle.

## Required record identities

Use stable logical IDs for passages, concepts, conclusions, expressions, manuscript principles and editor blocks. Use immutable revision IDs for text and meaning states. Display numbers and positions are changeable presentation properties, not primary identities.

| Record | Critical identity and payload |
|---|---|
| Edition | Translator, work/edition/ISBN, acquisition and rights metadata, actual format, file hash, parser version |
| Passage revision | Edition-specific label/order, immutable source text, locator, text hash |
| Source span | Passage revision, scalar offsets, exact text, context and validation result |
| Proposition revision | Claim, assertion type, scope/modality/conditions, source spans |
| Concept revision | Definition, inclusion/exclusion, parent decisions and history |
| Membership | Source/proposition revision, concept revision, rationale/relevance, review state |
| Conclusion revision | Statement, practical implication, scope, qualifications, assumptions, interpretation type |
| Evidence bundle | Target revision, participating links, joint/independent semantics and inference explanation |
| Evidence link | Source/target revisions or spans, relation, justification, reviewer and validity state |
| Expression revision | Reader text, stable blocks, clause mappings, variants and semantic-review state |
| Manuscript revision | Ordered hierarchical blocks referencing exact expression revisions |
| Run/review | Inputs/configuration, model/prompt/schema versions, costs/tokens, outputs and decisions |

Embeddings, projections, cluster assignments, jobs and ranking assessments need their own versioned records. Do not hide every relationship in a single mutable workspace JSON document simply because snapshots are useful for recovery.

## Exact anchor convention

Offsets are zero-based Unicode scalar indices with a half-open interval `[start, end)`. Store the exact substring, prefix/suffix context, source hash and passage revision. Python indices and browser/editor UTF-16 positions require explicit conversion.

Never split a surrogate pair. Do not treat a combining sequence as one scalar merely because it appears as one glyph. Grapheme navigation can help the editor, but the persisted anchor convention must remain explicit and tested.

Models may propose text and context. Code locates and validates it. Zero matches fail; several matches without sufficient context require review. A plausible invented quote does not become valid because it resembles something Marcus might have said.

## Meaning clauses and expression clauses

Introduce an explicit target-span representation for conclusion text. A conclusion clause maps to an evidence bundle or an identified subset of evidence links, with an explanation of their joint role. It must not derive from itself merely to reuse the existing expression grounding mark.

An expression clause maps to reviewed conclusion revisions and then transitively to source evidence. These are different mapping levels. Name them and validate them separately. The existing expression-only grounding mark should not be stretched into an ambiguous all-purpose self-reference.

At bundle granularity, it is valid to highlight a whole statement and say that the set supports it jointly. It is invalid to distribute colors across individual words without a stored clause-level assessment.

## Immutable revision rules

Text, conditions, qualifications, practical implications, assumptions and interpretation changes create a new conclusion revision. Expression edits create a new expression revision. Keep prior wording, prior reviews and prior mapping snapshots available.

An evidence relation or justification change also needs a versioned evidence assessment. If current storage mutates an active link payload, preserve an inspectable historical revision or event/snapshot reference. A previous human approval must remain reproducible against the evidence state the reviewer actually saw.

Locks protect deliberate editorial decisions. Unlocking is an explicit action; a model rerun or a new cluster proposal cannot override a lock. A stale concurrent save fails rather than replacing a newer decision.

## Invalidation propagation

On substantive conclusion edit, mark copied assessments stale, preserve the previous reviewed revision and invalidate dependent expressions and manuscript blocks. On source revision change, identify affected spans and invalidate all downstream assessments that rely on that revision. Do not silently reanchor into newly imported text.

On expression edit, clear or conservatively invalidate changed mappings and require semantic review. On manual source-link changes, invalidate the affected conclusion assessment and dependents. On concept membership changes, do not invalidate unrelated evidence merely because a theme label moved.

A ranking profile change affects ranking output, not citation validity. A projection rerun affects map coordinates, not accepted ontology or reviewed teachings. Keep these invalidation domains explicit to avoid treating every UI action as a reason to regenerate everything.

## Joint inference

A bundle must explain which premises are required together. Suppose one span identifies judgment, another recommends fair action, and another rejects passive submission. Their combination can support a qualified teaching. It does not mean each excerpt independently proves every clause.

Store bundle mode and participation. Show the distinction in inspectors and exports. A future system may need alternative bundles or alternative interpretations of the same source set; preserve them rather than overwriting the first accepted interpretation.

## Consistency checks

Validate that target mappings refer to known immutable revisions, source spans resolve exactly, dependency edges do not cycle, memberships have the correct typed source, and manuscript blocks reference the reviewed expression revision intended by the editor.

Database constraints should protect meaningful relationships as well as application code. Transactions should commit the revision, mappings, assessments and event together. Backups and recovery snapshots are additional safeguards, not a substitute for relational integrity.

## Completion gate

A reviewer can reconstruct why an earlier version was approved, what changed, which support became stale, and which downstream outputs need attention. All visible arrows and text colors come from stored validated relationships. No regeneration, schema migration or visual convenience silently invents or transfers support.
