# Manuscript assembly, coverage and export plan

## Intended book

The manuscript is an editorial reconstruction from Meditations. It should be navigable, concentrated and practically meaningful, while keeping qualifications, distinctive claims and unresolved tensions visible. “Bible-like” means stable references and organized teachings, not invented divine authority, faux-ancient language or a mandatory list of commandments.

The software must help the editor answer why a principle appears and why it is phrased that way. The answer must survive export, reordering and future revisions.

## Structural model

Use stable identities for parts, chapters, principles and manuscript blocks. Store display numbers and order separately. A principle that moves from chapter two to chapter five retains its stable ID and source lineage.

A proposed hierarchy is parts, chapters, numbered principles, explanations, optional practices/questions and evidence notes. Treat any provisional topic outline as an editorial hypothesis. The corpus may reveal material that does not fit judgment/action/anger/mortality categories comfortably.

Manuscript blocks reference exact expression revisions. Do not store only copied prose that loses its relationship to reviewed meaning. An adopted successor expression should create a new manuscript revision or explicit adoption event.

## Three reading products

1. **Compact core:** concentrated accepted teachings with necessary limits and concise source references.
2. **Full handbook:** fuller explanations, labeled applications and more extensive notes.
3. **Study view:** evidence bundles, original-source click-through, alternative interpretations and unresolved tensions.

Length budgets should be adjustable after reviewing the material. Do not pad a chapter to hit a predetermined number of principles, and do not achieve brevity by deleting every qualification.

## Assembly process

Choose eligible reviewed conclusions, inspect distinctiveness and overlap, select reviewed expression revisions, organize them into a hierarchy, and check the coverage ledger. Generate or edit connective prose separately from substantive claims.

When a new chapter draft is generated, retrieve the reviewed conclusions and their actual evidence. Do not rely only on the previous generated draft or produce the final manuscript by summarizing summaries repeatedly. A model-assisted structure is a proposal, not automatic adoption of every ranked item.

Manual reordering, merges, deferrals and omissions must persist across computational reruns. Preserve why a teaching is in the core, a companion section, a disputed appendix or no current manuscript at all.

## Coverage ledger

Track source ideas and propositions as `represented`, `merged`, `deferred`, `disputed` or `intentionally_omitted`. Each non-representation status needs a concise reason and responsible decision/revision.

Coverage is not the percentage of source words copied. Repetition can be consolidated, while a rare distinctive qualification can require explicit representation. A single passage may contribute several ideas with different ledger states.

Keep unresolved material visible. A neat-looking outline must not hide unassigned passages, source conflicts or difficult metaphysical premises. Coverage measures and redundancy review should inform editorial decisions without turning them into automatic word-count optimization.

## Practices and modern applications

Separate practices directly grounded in the source from modern exercises, examples and questions. Label their status in both UI and export. A helpful exercise does not become a quotation or a direct ancient instruction merely because it appears beneath a reviewed principle.

Review added applications for new obligations, psychological claims or guarantees. They may need their own evidence or belong in a labeled companion section. Do not use the practical layer to smuggle unsupported doctrine into the core.

## Export products

Support Markdown manuscript, standalone HTML manuscript, JSON concepts, JSON conclusions, JSON evidence links, JSON reviews and JSON ranking data. Include a provenance appendix and a machine-readable manifest identifying editions, corpus revisions, expression/manuscript versions and relevant model/run configurations.

Standalone HTML must preserve navigability, references and review/interpretation labels without requiring a running application. Neutralize active imported markup and external dependencies. Source text policies depend on export mode, not on whether the HTML happens to be local.

## Private-study versus shareable mode

Private-study mode can include the source context authorized for that use under the recorded assumptions. Shareable mode excludes the full translation by default, flags quotations for rights review and clearly identifies editorial wording.

Do not silently flatten source references into fabricated page numbers or omit revision identities from machine-readable data. Reordering must not break links. A later source or expression revision should leave an exported artifact reproducible as the version it actually was.

## Stale and unresolved export behavior

Warn or block inclusion of stale/unapproved substantive material in a core manuscript export according to an explicit policy. A study export can include disputes when they are clearly labeled; it must not make them look accepted.

The exporter should report excluded blocks, unresolved rights flags, broken references and unsupported additions. A successful file write is not proof that the content passed evidence review.

## Completion gate

A compact book can be assembled from accepted material, reordered without identity loss, inspected back to exact evidence, and exported with intact references and a manifest. The editor can see what was concentrated, what remains unresolved and why particular wording was adopted.
