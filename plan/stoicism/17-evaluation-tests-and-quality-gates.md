# Evaluation, test matrix and quality gates

## Separate kinds of correctness

Aurelius needs several independent measurements. Exact citation validity, human-rated interpretive fidelity, retrieval recall, conceptual coverage, redundancy and practical clarity must not be collapsed into one “quality” percentage.

Mechanical tests can show that a substring resolves and a graph remains acyclic. They cannot independently establish that a philosophical inference is sound. Human review can assess meaning while still missing a software bug in exported references. Preserve both forms of evidence.

## Evaluation sets

Keep three clearly separated sets:

1. Deterministic software fixtures for anchors, edits, state transitions and numerical analysis.
2. Substantial synthetic editorial cases for demonstrating qualifications, disagreement and overreach.
3. Human-reviewed real-corpus cases, created only after authorized import, with a held-out subset outside prompt tuning.

Do not publish synthetic retrieval or fidelity results as findings about Meditations. Record fixture/corpus versions and which cases informed prompt changes. A model-assisted grade is a provisional assessment, not the sole sign-off.

## Anchor and import tests

Cover exact matches, invented quotations, repeated phrases with/without context, changed source hashes, wrong revision IDs, invalid ranges, emoji, surrogate boundaries, combining marks, invisible characters and typographic punctuation.

Import tests cover source order, canonical labels, differing edition boundaries, exclusions/authorship, footnotes, broken encodings, normalization mappings, archive traversal, expansion limits, encrypted files and active markup. No suspicious extraction artifact should be silently dropped to make the import report look clean.

## Provenance and revision tests

Verify many-to-many evidence, joint bundles, separate concept membership, invalid references, target-clause mappings, locks, explicit unlock, stale concurrent saves, append-only reviews and acyclic derivation/hierarchy rules.

Any substantive meaning edit creates a successor requiring review and invalidates dependent expressions/manuscript blocks. A relation or justification change preserves the earlier inspected evidence state. Rewriting wording back to an earlier sentence does not transfer approval automatically to a new saved revision.

Test explicit discard separately from save/undo. A discarded unsaved draft restores the unchanged saved version. A saved edit followed by a later reversal is a new editorial revision.

## Highlight and connector tests

The default two-pane screen must show visible source colors in the left text and corresponding target highlights on the right. Inspect actual rendered color/background and screenshots; do not pass a visual requirement solely because a style attribute contains the word gradient.

Check overlapping contributor sets, relation labels, whole-statement versus clause granularity, unsupported additions, stale/historical mappings, keyboard focus, touch inspection, plain mode and theme-mode separation.

Connector tests verify stored edge identities, correct source/target ranges, independent scrolling, viewport clipping, wrapping, font load, resizing and edits. Offscreen arrows should not point into unrelated visible text. Selection must remain stable across DOM fragmentation.

## Retrieval and analysis tests

Verify fixed model/dimensions, complete-input/config cache identity, finite vector validation, exact cosine search, literal/reference lookup and no silent truncation. Interrupted embedding runs should resume without re-embedding completed unchanged items.

For PCA, validate input order/hash, preprocessing, fitted state, coordinate reproduction and explained variance. Account for sign-equivalent fits and low rank. For clustering, assert that average/cosine receives the declared full-dimensional baseline, not the plotted two-column coordinates.

Exercise zero/non-finite vectors, dimension mismatch, duplicate vectors, ties, missing rows, outliers and insufficient samples. Do not treat a neat-looking chart as proof of correct mathematics.

## Philosophical adversarial cases

| Case | Expected review concern |
|---|---|
| Same subject, opposite assertion | Challenge rather than support |
| Conditional recommendation | Preserve its condition |
| Description of impermanence | Do not invent an obligation without a bridge premise |
| Personal self-reminder | Do not universalize without labeling the inference |
| Social duty versus withdrawal | Preserve practical tension |
| Attractive universal promise | Reject unsupported certainty |
| Two translations of one passage | Do not count as independent evidence |
| Distinctive rare claim | Do not discard solely for low cluster frequency |

The critic must be able to reject. Human reviewers should record why an accepted reconstruction remains faithful and what uncertainty remains.

## Operations and budget tests

Use mock adapters for ordinary tests. Exercise cancellation before/during work, rate limits, partial success, authentication errors, repeated validation failures, maximum repair attempts, restart and budget exhaustion. Confirm the model cannot raise limits or approve itself.

Simulate unknown transport outcomes and confirm uncertainty is retained. Verify successful persisted results are reused and failed items do not masquerade as completed work. Check that public builds never contact a private API or expose source files.

## Existing-workspace regression matrix

Test fresh browser, old synthetic browser database, edited browser database, current private SQLite, preceding migration, locked decisions, stale expressions and multiple tabs. The current seed-only initialization needs particular attention: existing stored data must receive a safe content/analysis upgrade without being replaced wholesale.

Test private service unavailable, browser storage unavailable/quota failure, missing artifact, corrupt snapshot hash and interrupted migration. Preserve drafts and recovery data where possible.

## Release evidence

Run repository TypeScript and production build for meaningful frontend/config changes, plus appropriate lint/unit/integration/browser checks. Record actual commands and outputs. A screenshot, hot reload or HTTP 200 is not sufficient frontend verification.

Export tests resolve references and revision IDs in Markdown/HTML/JSON, confirm source full text is excluded in shareable mode, and verify rights-review flags. Keep private-source screenshots/logs out of public artifacts.

## Completion gate

Each requirement has specific evidence: automated test, numerical artifact, screenshot/manual accessibility review or human fidelity decision. Unrun checks remain unrun. Known failures and unresolved passages remain visible rather than being hidden behind an aggregate pass count.
