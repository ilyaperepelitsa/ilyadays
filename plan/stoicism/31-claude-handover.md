# Claude handover — Stoic Constitution

22 November 2026 · `ilyadays` · local `main` at `53ccb48`

## Status on 23 November 2026

Claude carried out the suggested slice below on the visual study, for both pairs. Read this section first; the rest of the handover is kept as written on 22 November.

- **Done.** Every article phrase is marked by source and traces to exact words, function, typed relation and editorial step. “(if it be possible)” hangs on “consider” in the passage view and in every article that uses the instruction. Both readings of “reason with thyself” can be selected, and the article wording follows. The three articles sit side by side. Removing B strikes out only the dependent words and leaves A's wording fixed. The declined join marks both branches. Kinship in 1.15 has its own anchored pieces, and the practice quotes the complete 6.5 maxim with its revenge frame.
- **Added.** Word counts by source for each draft, a mechanical check that a used piece travels with what qualifies or completes it, shareable URL state, Keep/Revise/Drop verdicts saved in the browser, and [a test](../../tests/aurelius/composition-study.test.mjs) tying the page to the public study.
- **Known flag.** The two-test article for 1.15 + 6.5 uses the maxim's standard without its revenge frame. The page reports this. It is left for editorial judgment.
- **Open.** The user's verdicts on the six drafts, the choice of a production extraction format, and the screen-reader pass. `node --test tests/aurelius/*.test.mjs` has two failures in `book.test.mjs` and `real-corpus.test.mjs` that come from the earlier uncommitted reader and study edits.

## The first five articles (23 November 2026)

The user then asked for the first five constitution articles, with topics derived hierarchically from clusters and every element traceable. See [the page](../../public/apps/stoic-constitution.html), [the authored record](../../content/aurelius/constitution.json) and [the topic hierarchy](../../content/aurelius/topics.json).

- **Topics.** Ward linkage over the cached Casaubon vectors gives 7 chapters and 38 sections. The stored average and complete hierarchies were too lopsided to use and are unchanged. Chapter order is editorial; section order follows the tree.
- **Articles.** The first five sections of chapter 1, “The whole and my place in it”, each became one article. The first version paraphrased one passage per point and the user rejected it as concatenation. The current version fuses: parallel exact quotes from two to five passages are merged into a claim, the claims into a thought, and single-witness statements are kept apart as “said once”. The user said the overall direction and structure are good.
- **Statement and subarticles (schema 3).** At the user's request each article now opens with one short statement, followed by subarticles under five fixed labels: Why, In action, Practice, When it breaks, If I doubt it. A label with no passage stays empty and says why. Every sentence is split into components, each mapped to the quotes behind it; passage numbers sit in the text and the hover card lists the quotes for the hovered words plus every other component's passages. One quote may back several components (`gives` is a list), and 31 of 79 claim components now rest on more than one passage. Each quoted passage also carries `follows`, a one-sentence conclusion drawn from that passage alone, shown in a column parallel to the passage (stacked on phones).
- **Parked and continued.** The schema-3 version is pushed as `d576e71`. Since then, uncommitted: labels as columns on wide screens; coloured lines per source passage instead of superscripts in subarticles (five validated colours, assigned by the build); a vector map with a similarity table beside each statement. See rules 7 to 11 in the article prompt.
- **Seneca.** Gummere's translation of the Letters is a second private corpus (`scripts/aurelius-seneca.py`: fetch, parse, preview, embed, arrays, attach; 2,140 passages; vectors in the shared cache). Each of the five articles has a `seneca` entry: what the article becomes, and items that are stronger, wider or qualified. Not yet reviewed by the user. Open: the other Seneca works, and Epictetus.
- **Cards, body clauses, vectors column (later on 23 November).** After the owner's review: every bit is one card with one border and the author's name in its corner; the per-article strip is one sentence, three counts (Backs, Adds, Challenges) and one button; Seneca's additions now enter the statement and claims as tagged clauses (`voices.seneca.amend`, eight so far) that vanish when he is switched off; the vectors are a sticky column of their own that no longer pushes the five sides down, with headline numbers, the section's ground shaded, and a live readout. Rules 14 and 15 in the article prompt. The earlier open question (may a second author change a statement's wording) is settled: he may append a marked clause; Marcus's words are never rewritten.
- **Milestone M1 (23 November).** Done in a delegated run: section reader and browser check scripts, the data split into an index and one file per chapter with a chapter picker, and Article 6, which completes chapter 1. Uncommitted. See the log entry of that date.
- **What to do next.** [The delegation plan](32-delegation-plan.md) turns everything outstanding into tasks a simpler model can carry out, opens with the goal of a run (section 0) and groups the work into nine milestones (section 5): foundations and Article 6, rights, one milestone per chapter, the page, loose ends.
- **Standing instruction.** Any feedback from the user is generalised into a dated rule in [the article prompt](../../apps/aurelius/prompts/constitution-article.md) and applied to every article. Rules so far: fuse and do not concatenate; keep quote tracking, including on hover; write in article voice; say it plainly; one statement then labelled subarticles; show several sources at once, component by component; give every quoted passage its own conclusion.
- **Open.** The user's verdicts on the five articles and on the chapter names. Thirty-two section names outside chapter 1 are provisional. The sixth section of chapter 1 is next. Rebuilding needs the private `.aurelius/` corpus: run `scripts/aurelius-topics.py`, then `scripts/aurelius-constitution.py`.

## What the user wants

Build a personal constitution from Marcus Aurelius. The user disliked earlier attempts to merge passages because the resulting prose obscured how one idea contributed to another. They want to judge the mechanism visually, all the way to the finished article, and compare alternatives using explicit scores.

**Concept → exact source words → function within a complete thought → editorial connection → article clause**

A theme such as *judgment* helps find material. A function such as *qualifies this instruction* tells the composer what must travel together. Keep two decisions distinct throughout the work:

- **Extraction** chooses what each passage contributes on its own. Four methods have been compared.
- **Composition** chooses how those contributions work together. The three proposals are a practice, an argument, and two independent tests of a decision. “Keep separate” is a valid outcome.

## Open these first

| Artifact | What Claude can do with it |
|---|---|
| [Visual composition study](../../public/apps/stoic-composition.html) | Switch between two passage pairs, read each passage piece by piece, compare the three draft articles, tap a phrase to see its source words or the editor's step, and remove passage B to see which words depend on it. This is a hand-worked prototype. |
| [Method scorecard](30-method-scorecard.html) | Start with the ranking, move the weighting slider, and expand any case to see its actual text, criteria and both scorers’ decisions. The JSON download contains the evidence needed to reproduce the scores. |
| [Visual editorial review](28-visual-study-review.html) | Annotated screenshots locate the misleading connections in the 22 November prototype. The review includes a proposed repair for one clause. |
| [Extraction comparison](29-extraction-comparison.html) | Read the initial four methods’ extracts and twelve articles side by side. The later scorecard adds the adversity case. |
| [Composition models](27-passage-composition-models.md) | Definitions, worked joins, source-removal check and reusable instructions for an LLM. |

The HTML files open directly in a browser. The site's `/stoicism` reader also links to the prototype through [BookReader.tsx](../../src/components/aurelius/BookReader.tsx). The source of truth for this pilot is the [public Casaubon study](../../content/aurelius/backup-study.json). Its passage numbering and immutable revision IDs belong to that edition. For another edition, resolve its own evidence anchors.

## What the scores support

| Method | Extraction / 100 | Composition / 100 | Overall / 100 |
|---|---:|---:|---:|
| Complete thought + relations | 91.7 | 93.8 | **92.7** |
| Complete thought | 83.3 | 87.5 | **85.4** |
| Topic + exact quotation | 56.3 | 93.8 | **75.0** |
| Role + short fragment | 62.5 | 87.5 | **75.0** |

Each method produced three extracts and four articles. Two Codex scorers agreed on 125 of 128 binary decisions. Only the second scorer received anonymous sample IDs. Case percentages were averaged within each dimension, then the two dimensions received equal weight. The initial samples were scored retrospectively. Criteria for the new 5.16 + 5.20 case were fixed before generation.

**Working recommendation, awaiting human editorial judgment:** retain an exact source anchor alongside a complete thought. Add a typed relation when it changes the reading, e.g. *qualifies*, *answers*, *illustrates* or *objects to*. Keep exact quotation as the comparison method. It tied for the highest article score and uniquely kept the revenge context explicit in the 6.5 + 6.49 article. The pilot scores cover selected source claims and article requirements. Literary quality, personal resonance and corpus-wide performance remain open.

## Suggested next slice (carried out on 23 November)

Revise the existing visual prototype on **one pair before expanding coverage**. Casaubon **8.12 + 9.13** is a useful first choice because the same material supports a practice and exposes a failed join. This is a proposed next task. The user has requested a handover and has yet to choose a production extraction format.

1. Show the full 8.12 instruction with **“(if it be possible)”** visibly attached to **“consider.”** Keep the impression as the object. Show both readings of **“reason with thyself”** as a method or a coordinated second act. In 9.13 connect **“The understanding”** to the question it answers.
2. Put the candidate article wordings side by side. In the practice, mark asking about my own verdict as the editor's application of 9.13 during the exercise in 8.12. For the decision **“Is this verdict sound?”**, mark **both branches** as supplying no criterion of soundness. The present prototype marks only the second.
3. Let the reader select one meaningful article clause and see the underlying thought, exact quoted words, and any editorial step. When B is removed, hold A's wording fixed and show exactly what drops out. This makes source removal a real comparison.
4. For the other existing pair, repair **“Recall your kinship.”** Its linked pieces currently say morning, self-address, and a railer. Either anchor the separate kinship claim in 1.15 or drop that instruction. Preserve the complete 6.5 maxim when using its revenge frame.

**Acceptance example:** a reader should be able to point to the condition supplied by Marcus, the question supplied by the editor, and the words in the article that would disappear without 9.13. Ask for the user's judgment on the actual article wordings before choosing a permanent format or scaling synthesis.

## Implementation and verification

Reuse the existing [annotation language](../../docs/aurelius/annotation-language.md) for exact quotes, revision IDs, voice and argument relations. Keep author-given reasons, analogies, source conditions and editorial bridges legible. The private Hays corpus has separate processing and reuse boundaries. The [delivery plan](24-delivery-delegation-and-user-run-batches.md) records the user-run workflow for long jobs.

The worktree contains pre-existing edits across the reader, workbench, backend and tests. At handover the numbered studies 27–30, the visual prototype, reader component and generated alignment data are **untracked**. A fresh clone at the commit above will lack them. Continue in this worktree or transfer those files deliberately. Check `git status --short --branch` before editing, and follow the repository's [AGENTS.md](../../AGENTS.md).

Previous checks passed for TypeScript and the production build. The scorecard's rank order, ties, downloads and rounding were checked at all 101 slider settings. For the next UI change, run `npm run typecheck` and `npm run build` from the repo root. Also inspect the actual reader on desktop and mobile, switch the source pair and composition model, follow a clause to its evidence, and verify what happens when B is removed.
