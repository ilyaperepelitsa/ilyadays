# Stoic Constitution — plan after the two reviews

Written 23 November 2026. It turns [the second review](33-astra-review-handover.md) (sections 7 and 8) into work, in an order that fixes the checks before more articles pass through them. It replaces "next: M2 or M3" in [the delegation plan](32-delegation-plan.md): drafting of Articles 7 to 38 is on hold until N3 below is accepted. Reading chapter 2 and collecting Seneca candidates may go on meanwhile.

Sections 3 and 4 of the delegation plan (rules that never bend, commands) still apply to every task here.

## What the reviews established

The promise of the page is that pointing at words shows why those words belong. Three kinds of failure break it, and all three passed 20 of 20 tests:

1. **Wrong meaning behind a right quote.** An exact span of Seneca about everything perishing backs a clause about working together (Article 6, Ep. 71.13).
2. **Markings that say something false after an interaction.** A selection jumps to another phrase when Seneca is switched on; a card says "Fused from 3 passages" after one is removed.
3. **Checks that measure the pool, not the article.** Shared components are 35% overall and 0% in Article 5.

So the order is: make the checks and the markings trustworthy (N1), give the reader evidence in plain English (N2), then revise Article 6 on that footing and audit Articles 1 to 5 against the same bar (N3).

Not re-verified by the author of this plan: the five cases in section 8 of the review. Each task below starts by reproducing its case as a failing test or fixture, which settles it.

## Decisions for the owner

| # | Question | Recommendation |
|---|---|---|
| Q1 | Commit now? Everything since `d576e71` (colours, vectors, Seneca, cards, M1) was uncommitted. | **Answered 23 Nov: "commit it."** Committed locally, not pushed. From here: one local commit at the end of each milestone, never a push without the owner's word. Note for any push: the commit contains quoted sections of Gummere's Seneca, whose rights are unverified (Q5). |
| Q2 | The review records as your request a project translation of the *Meditations* from the Greek into contemporary English. Confirm, and say who checks the Greek. | Confirm as a pilot on Article 6's six passages only (N2). One model drafts from the Greek, a second checks it against the Greek without seeing the draft's reasoning, you read the six. No wider translation until you have read them. |
| Q3 | Adopt the review's marking of sources: thinner lines, and on selecting a phrase a short list "Sources for the selected words" under the sentence ([mockup](33-underline-review.png))? | Yes. It keeps colour = passage, fixes the unreadable three-line stack on a phone, and gives touch users what hover gives on a desktop. |
| Q4 | The audit in N3 will reach Articles 1 to 5. Article 1 was approved by you as written. | Seneca items and `follows` sentences may be corrected in all five. Changes to Marcus's wording in Article 1 are proposed to you first, not made. |
| Q5 | Seneca's translation rights (W5 of the delegation plan) are still unverified. If you like the project English for Marcus, the same method on Seneca's Latin would remove the rights question. | Decide after N2. Until then no new Seneca text is pushed. |

## Goal of a run

One milestone per run. A run's goal is met when all of these hold, and it then stops and reports in the three-line form of the delegation plan's section 7, written to `plan/stoicism/34-<milestone>-report.md`:

1. Every row of the milestone has a test or a browser-check case that was seen to fail before its fix and passes after. The report lists them, one line each: the case, the failure seen, the fix.
2. `apps/aurelius/.venv/bin/python scripts/aurelius-constitution.py` runs without an error.
3. `node --test tests/aurelius/constitution.test.mjs tests/aurelius/composition-study.test.mjs` reports 0 failures.
4. `scripts/aurelius-constitution-check.py` exits 0.
5. `npm run build` passes (stop the dev server first).
6. Nothing was pushed, no paid call was made beyond what the milestone names, and nothing under `.aurelius/` entered a tracked file.

**Out of scope for N1:** changing any article's wording, claims or quotes (that is N3), except the mechanical migration G2 names and the placeholder fields G7 and G8 need; anything about the translation (N2); Articles 7 to 38. Where G7 or G8 would require content that N3 will write, N1 adds the field to the schema, makes the build require it, and fills the existing pieces with the literal value `"TO REVIEW IN N3"`, which the build accepts until N3 and the report counts.

**Stop and ask** when a fix would change what an article says; when a check fails twice after a real attempt; when two rows of the plan conflict; or when a row cannot be reproduced as described (say so in the report and go on to the next row).

## Order

```
Q1 commit ─► N1 trust the markings ─┬─► N3 Article 6 revised, Articles 1–5 audited ─► owner review ─► resume Articles 7–38
             N2 translation pilot ──┘        (N2 and N1 run in parallel; N3 needs both)
```

| Milestone | Contains | Ends with |
|---|---|---|
| **N1** | G1–G8 (checks) and P1–P12 (page) | Build, tests and browser check pass; every case of the review is a test that failed before and passes now |
| **N2** | T1–T6 | You read six passages in Greek, project English and Casaubon side by side |
| **N3** | A1–A8 | Article 6 with Seneca on and off, and a one-page audit of Articles 1 to 5, for your verdicts |

---

## N1. Trust the markings

### Checks in the build and tests

`scripts/aurelius-constitution.py`, `tests/aurelius/constitution.test.mjs`. For each: first write the fixture or test that shows the fault, see it fail, then fix.

| # | Fault | Change | Passes when |
|---|---|---|---|
| G1 | Shared components are tested over all articles together (7/22, 10/15, 9/17, 5/16, 0/9, 3/11). | The build prints numerator and denominator per article. The test bounds each article: at least a third, or at least one shared component when the section has fewer than 8 passages. A named list `KNOWN_BELOW = [1, 4, 5, 6]` exempts today's failures; N3 empties it and the test then forbids the list. | The printout appears; removing an article from the list fails the test for that article. |
| G2 | A body clause may cite any Seneca piece in the article, whatever it is about. | `amend` entries gain `from`: the keys of the items that contribute the clause (`w1`, `q1`, or a stronger piece id). The build requires every id in `ids` to belong to those items; a clause on a claim with kind `challenges` needs a `qualified` item on that same claim; a clause on the statement needs a `wider` item, or a `stronger` item whose claim feeds that statement part. Migrate the ten existing clauses. | The review's fixture (prayer clause citing `S71.13c`) is rejected with a message naming clause, item and claim. |
| G3 | Two wider items with one key build, and one link opens two panels. | Keys of wider and qualified items are unique per voice and article; the error names both items. | The duplicate-key fixture is rejected. |
| G4 | In a section of fewer than five passages a statement part may have no witness at all. | Every part needs at least one id; at least one part needs two passages. | The review's fixture (section size four, first part emptied) fails. |
| G5 | A chapter file may lack an article its index lists, or hold one twice; the test joins by number and does not notice. | The test compares each chapter file's ordered article numbers with the index stubs: same list, no repeats. The page does the same before drawing (P8). | Both of the review's fixtures fail the test. |
| G6 | Colours separate passages only within one claim or one statement part. In Article 6's statement all three parts show the same pair. | Passages that appear anywhere in the same sentence (statement, or one claim) differ when five colours allow it; if they cannot, the build prefers to share between passages farthest apart in the sentence and says so. Re-check Articles 1 to 6 by screenshot: colours will move. | In Article 6's statement 10.21 and 10.22 differ. No article needs a sixth colour. |
| G7 | Nothing forces a reading of an added author's quote in its context. | Every added-author piece gains `context`: one sentence saying what the passage around the quote is about and what the quote's key noun or pronoun refers to ("'the same goal' is ceasing to exist"). The build requires it (20 to 200 characters); the page shows it in the quotes panel under the passage. It cannot be checked by a machine; it exists so that the writer must look and a reviewer can disagree. | The build rejects a piece without it. Backfilled for all Seneca pieces in N3. |
| G8 | No record of what was searched when choosing an added author's passages. | `voices.<author>.searched`: the words and phrases searched in the corpus, and for each passage considered and rejected, its reference and a reason in a few words. Required, at least three searches. Not published to the page; kept in the authored record. | The build rejects a voice without it. |

Also in this group: write chapter files compactly (`separators=(',', ':')`), keep the index readable; the build prints each chapter file's size and warns above 600 KB.

### The page

`public/apps/stoic-constitution.html`. Each row becomes a case in `scripts/aurelius-constitution-check.py`, which must fail on today's page and pass after.

| # | Fault | Change |
|---|---|---|
| P1 | The picked phrase is remembered as a position in the sentence. Switching a voice changes the positions, so the selection moves to other words (Article 3: "fit myself to it" becomes "more than accept it"). | Remember the picked words by their text and backing ids. After any redraw find the component with the same text; if none or more than one matches, clear the pick. Test both directions of the switch: selected text, highlighted quotes and map agree. |
| P2 | After removing a passage a claim still says "Fused from 3 passages". With all of Marcus's passages removed it says "No passage left" beside a live Seneca chip and strikes words that Seneca still backs. | Count surviving sources per claim and per phrase: "2 of 3 passages remain". When Marcus's passages are all gone say "Marcus's passages for this claim are removed; what remains is Seneca's", and strike only words with no surviving source. A removed chip stays visible, marked removed. |
| P3 | A verdict that cannot be saved (storage refused) silently springs back. | Keep the choice for the session, show "Could not be saved on this device" beside it, include it in the copied list. |
| P4 | Chapter changes replace the history entry; Back leaves the page. | A deliberate chapter change (picker, a link to an article elsewhere) pushes an entry; `popstate` restores chapter, voices and selection. Opening and closing panels still replaces. |
| P5 | A typed or restored `#article-N` in another chapter does nothing. | `hashchange` goes through `goToArticle`. |
| P6 | After a switch the chapter heading is under the sticky bar. | `scroll-margin-top` on `#articles`; the check measures the heading's visible bounds after the scroll. |
| P7 | `?without=` for an article outside the open chapter is dropped. | Keep unread parts of the query as they are until their chapter loads, then validate. |
| P8 | A chapter file that does not match the index draws as if complete. Retry reuses the cached bad data. A drawing error is reported as a loading error. | Validate before caching (article numbers equal the stubs', each has `claims`, `statement`, `members`); never cache a rejected file; separate the messages: "could not be loaded" with retry, "could not be drawn" with the article number and no retry. |
| P9 | The topic tree always opens chapter 1. | Open the chapter on screen. |
| P10 | At 390 px the bar shows Chapter and Articles 1 to 4; the rest, Topics and Sources need a sideways scroll. Chapter 2 has twelve articles. | The bar keeps Chapter, a single "Article N of M" button that opens a list of the chapter's articles with their titles, Topics and Sources. From 700 px the numbers return when they fit. The check asserts every bar control is inside the screen at 360 px. |
| P11 | Markings (needs Q3). One-source lines are heavy; three stacked lines on a wrapped phrase cannot be read; the editor's joining words carry no mark; with forced colours every line collapses to one underline. | Lines 1 px with clearance under descenders. Selecting a phrase tints exactly those words and lists under the sentence "Sources for the selected words": one row per source with its line sample, author and reference, in reading order, then "Show the quotes". Selecting a joining word says "The editor's connection" and why. In forced colours the list still names the sources. Then run the review's task with a reader: select the last phrase of Article 6's first claim, name its witnesses, open the quotes, say what changes when 4.19 is removed; record any wrong answer. Light, dark and forced colours, 390 and 1440 px. |
| P12 | The check has only ever seen one chapter. | Add the two-chapter simulation (serve an index in which Articles 4 to 6 belong to `c3`): picker switch, neighbour link across chapters, Back, deep links, voice kept, selection cleared. |

**N1 is done when** every G and P row has a test or check case that failed before its fix; build, tests and the browser check pass; Articles 1 to 6 have been looked at once at 390 and 1440 px after G6 and P11 moved their colours and lines.

---

## N2. Translation pilot: six passages from the Greek

Why: the article is in today's English, but opening its evidence sends the reader to 1634 ("The earth, saith the poet, doth often long after the rain"). The reader must translate before judging whether Marcus supports the claim. A second reason came out of the review: several disputed mappings (who the prayer is for in 5.7; "tend" in 4.19) are questions the Greek can settle and Casaubon cannot.

Scope of the pilot: the six passages of section `c6.s6` and nothing else. No re-embedding, no re-clustering: the topic hierarchy stays as built from Casaubon.

| # | Task | Detail |
|---|---|---|
| T1 | Choose and record the Greek edition. | A critical text whose editor died more than 100 years ago if one is good enough, else more than 70 (rule W5.2). Candidates, from memory and to be verified with sources: Leopold (Oxford, 1908), Schenkl (Teubner, 1913), Haines (Loeb, 1916). Record edition, editor's dates, where the text was taken from, and its licence. Downloading it needs your permission at that point. |
| T2 | Crosswalk. | Casaubon numbers sections differently from modern editions. For the six passages record Casaubon reference → standard reference, aligned by the text, not the number. Believed from memory, to verify: 10.22 → 10.21, 4.19 → 4.23, 6.38 → 6.43, 10.21 → 10.20, 8.54 → 8.57, 5.7 → 5.7. The page should show the standard number beside Casaubon's from now on; readers who know Marcus look for 4.23. |
| T3 | Translate. | Direct contemporary English, first draft by one model from the Greek alone. Preserve speaker, addressee, scope, negation, qualifications and image. In 10.22 the poet's image and Marcus's inference stay distinct. In 5.7 keep the Athenians and their fields, and the turn from the quoted prayer to Marcus's comment. No smoothing that settles an ambiguity silently: where the Greek is open, translate one reading and note the other. |
| T4 | Check. | A second model reads Greek and English without the first's notes and lists every place where the English says more, less or other than the Greek. Disagreements are settled in writing, per passage. Open questions that affect an article (the scope of Marcus's comment in 5.7) are answered here, before N3. |
| T5 | Store. | `content/aurelius/translation/project-v1.json`: per passage the Casaubon revision id, the standard reference, the Greek, the English, translator's notes, and a revision id of its own (hash of edition, reference and text). Ours, so it is tracked and public. A revision never changes; a correction is a new revision. |
| T6 | Show. | A small page section or panel for the six: Greek, project English, Casaubon, side by side on a wide screen and switchable on a phone. This is what you read. |

**N2 is done when** you have read the six and said keep, revise or stop. Only then is anything wider considered (all 418 passages are about 46,000 words in Casaubon).

Design note for after the pilot, not for now: an article names the edition its quotes are anchored in; the build validates each quote as one exact span of that edition; the evidence panel shows the project English by default with Greek and Casaubon on request and highlights each edition's own aligned span. A second translation of a passage is still one passage.

---

## N3. Article 6 revised; Articles 1 to 5 audited

Needs N1 (the checks) and N2 (the six passages in reviewed English). Article 6 becomes the first article anchored in the project translation; Casaubon stays available beside it.

| # | Task | Detail |
|---|---|---|
| A1 | Rebuild the claims on what two passages really share. | Keep the core the review found strongest: 10.21 with 4.19 on what comes being good and timely. Separate cosmic order (6.38, 10.22: parts with their own work, drawn together) from personal benefit; do not let 4.19 "to thee all tend" back "work toward one end". Aim: every fused claim has a component both witnesses say. |
| A2 | Move the prayer out of the fused claim. | 5.7 becomes a said-once practice, worded to the scope T4 settled (for example "When I pray, I ask for what my community needs"), labelled where it is the editor's application. |
| A3 | Mark the inference. | "…so I want what the world wants": the "so" is the editor's. Record it in `statement.parts` as an editor's connection with one sentence of why, so P11 can show it. |
| A4 | Say what is new. | `limit` names Article 3 and states what Article 6 adds: timing. If after A1 nothing but timing is new, say so plainly; the article may be short. |
| A5 | Narrow six `follows`. | `10.21b`, `6.38a`, `5.7b`, `S66.5a`, and whatever replaces `S71.13a/c`. Each must follow from its passage alone and no further. |
| A6 | Seneca again, by the full procedure. | Word search first, logged (G8): at least "willing", "Fate", "pleased", "season", "pray", "whole", "part". Read Ep. 107.9–12 and 74.20 in context; write `context` for every piece (G7). Remove `S71.13a` and `S71.13c`. Keep `w3` (hold my ground) as an addition and say what it resists: suffering, not an obstacle to be attacked. |
| A7 | Rewrite both body clauses. | Statement: Ep. 96.2 supports receiving hardship willingly, not wanting it. Claim clause: asking for joy outright and for endurance only at need does not contradict praying for everyone; make it an addition or find a real disagreement, else drop it. |
| A8 | Audit Articles 1 to 5 against the same bar (Q4). | For each: the per-article share (G1) and a rewrite where it is below the bar (Article 5 at 0 of 9 first, then 4 and 1); `context` for all 44 Seneca pieces, removing any whose context contradicts its use; the ten clauses against A7's two tests (does the clause say more than its quote; is a "challenge" a real one); a logged word search per article for passages the vectors missed. Output: one page, per article, of what changed and what is proposed. |

**N3 is done when** `KNOWN_BELOW` is empty; a second reader, given Article 6 cold, can name for each claim what each witness contributes, where the editor infers, and what Seneca really adds or disputes; and you have given verdicts on Article 6 with Seneca on and off.

---

## What changes in the standing documents

- **Article prompt** (`apps/aurelius/prompts/constitution-article.md`), once you accept this plan: new rules for (a) reading an added author's quote in its context and writing down what it refers to, (b) searching by words as well as by vectors and logging it, (c) a clause never saying more than its quote, and "challenges" only for a real disagreement, (d) the editor's inferences being marked as such, (e) evidence shown in the project's contemporary English with the Greek and the older translation on request. Each with its source: your request for (e), the review for the rest.
- **Delegation plan**: W3 and W4 gain the steps above; W1.3's small-section rule is corrected (G4); section 1 is rewritten for the present state; M3 onward wait for N3.
- **Architecture decisions** (`21-architecture-decisions-and-open-questions.md`): record the project translation beside the earlier edition decision.

## Risks

| Risk | What to do |
|---|---|
| The translation grows into the whole project before six passages are judged | N2's scope is fixed at six; nothing wider starts without your word |
| A model's Greek is confidently wrong | Two independent passes, disagreements written down, the Greek shown beside the English so anyone who reads Greek can object |
| G1's bar pushes writers to invent a second mapping to raise the score | G7 and the cold second reader in N3; a share reached by a false mapping is worse than a low share and the audit says so |
| P11 changes a look you liked | The mockup first, then one article, before all six |
| A big uncommitted tree | Q1 |
