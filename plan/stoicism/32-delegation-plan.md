# Stoic Constitution — delegation plan

Written 23 November 2026 for a model that has not seen the earlier sessions. It turns every outstanding item into tasks with exact files, commands, checks and stop conditions. Read sections 0 to 4 before touching anything. Then work milestone by milestone (section 5).

**Progress.** M1 done on 23 November 2026 (uncommitted, awaiting the owner's review of Article 6 and of chapter navigation). Section 1 below describes the state before M1; since then W1's two scripts exist, the data is split per chapter (W2), and chapter 1 is complete with six articles. Next: M2 (rights) or M3 (chapter 2).

The product is one static page, `public/apps/stoic-constitution.html`, which shows a "constitution" built from Marcus Aurelius's *Meditations*: each topic becomes an article, every word of an article is traced to exact quoted passages, and other authors (first: Seneca) can be switched on to see what each article gains.

---

## 0. The goal

**End state.** All 38 sections of the topic hierarchy have an article on the page, each traced word by word to exact quotes, each with Seneca's contribution, readable on a phone, with the owner's review tools in place and the translation rights recorded.

**A run has one milestone as its goal** (table in section 5). The goal of a run is met when all of these are true, and the run then stops and reports:

1. Every task of the milestone meets its own "Done when".
2. `apps/aurelius/.venv/bin/python scripts/aurelius-constitution.py` finishes without an error.
3. `node --test tests/aurelius/constitution.test.mjs tests/aurelius/composition-study.test.mjs` reports 0 failures.
4. `scripts/aurelius-constitution-check.py` (W1.2) exits 0, with and without `?with=seneca`.
5. Nothing was pushed; nothing was committed beyond what D1 allows; no paid call went beyond D2.
6. The report of section 7 is written, and it lists every place where the run stopped to ask.

**Out of scope for every run:** re-clustering or moving passages between sections; changing the five labels, the palette or the schema's meaning; rewriting Articles 1 to 5 beyond what a task names; adding an author other than as W10 describes; anything outside the Aurelius files listed in section 1 (the fitness and recipe parts of the repo are not touched, except the one test in W9).

**Stop and ask, do not guess, when:** a "When to stop and ask" condition of W3 is met; a rule of section 3 would have to bend; a check fails twice after a real attempt to fix it; or the private corpus under `.aurelius/` is missing.

> **Amended 23 November 2026, after two reviews of milestone M1** ([plan 34](34-after-review-plan.md), [log](35-completion-log.md)). The state below is as of that date; the amendments are marked where they apply. **Articles 7 to 38 (M2 onward) wait for the owner's verdicts on the translation pilot, on Article 6 and on the audit of Articles 1 to 5.**

## 1. What exists today

| Thing | Where | State |
|---|---|---|
| Parked version | commit `d576e71` on `main`, pushed | Statement, five labelled subarticles, columns on wide screens |
| Work since then | uncommitted in the working tree | Colour per passage, the vectors column, neighbours, Seneca (items and body clauses), Voices dock, one-border cards with the author's name, phone tabs |
| Topic hierarchy | `content/aurelius/topics.json` (built by `scripts/aurelius-topics.py`) | 418 passages, 7 chapters, 38 sections. Final. |
| Authored record | `content/aurelius/constitution.json` | Schema 3. Articles 1 to 6 written and audited (23 Nov 2026); Article 6 quotes the project's translation. 32 sections have a name and no article. |
| Build and validator | `scripts/aurelius-constitution.py` | Writes a small index and one file per chapter. Fault fixtures: `scripts/aurelius-constitution-fixtures.py`. Browser check with named cases on a frozen fixture record: `scripts/aurelius-constitution-check.py` |
| Project translation (pilot) | `content/aurelius/translation/project-v1.json`, `scripts/aurelius-translation.py`, `public/apps/stoic-translation.html` | Six passages (section c6.s6) from Leopold's Greek, checked by a second reader, embedded with the corpus model. Awaiting the owner's reading. |
| Seneca corpus | `scripts/aurelius-seneca.py`, data under `.aurelius/` (git-ignored) | 124 letters, 2,140 passages, embedded |
| Page | `public/apps/stoic-constitution.html` | One file, vanilla JS and CSS, about 1,500 lines |
| Tests | `tests/aurelius/constitution.test.mjs` | 14 tests, all pass (19 with `composition-study.test.mjs`) |
| Writing rules | `apps/aurelius/prompts/constitution-article.md` | Task steps plus rules 1 to 21, each with the owner's dated words or the review it came from |
| History | `docs/aurelius/implementation-log.md`, `plan/stoicism/31-claude-handover.md` | Up to date |

The private corpus lives in `.aurelius/` and is not in git. Without it the build cannot run. It is present on the owner's machine:

- Marcus: `.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/` (`corpus.json`, `projection-arrays.npz` with `vectors` 418×3072).
- Seneca: `.aurelius/corpora/seneca-gummere-wikisource/` (`corpus.json`, `vectors.npz`, `inspection.json`, `candidates.json`), raw pages in `.aurelius/imports/seneca-gummere-wikisource/`.
- Embedding cache: `.aurelius/vectors/` (SQLite, used through `apps/aurelius/aurelius/embeddings.py`).

### How the page is put together

Know these names before changing the page; the tasks below use them.

- **Layout.** Each article is `.leaf` → `.body`, a grid of four children: `.lead-col` (statement, one slim strip per added author, the passage chips), `.sci` (the vectors column), `.tabs` (phone only) and `.grps` (the five sides). From 1000 px the vectors are a column of their own on the right, `position: sticky`, no taller than the screen; the sides are a grid of 2, 3, 4 or 5 columns by screen width. Under 1000 px everything stacks: statement, vectors, tabs, sides. Nothing may be added that makes the vectors column push the sides down (rule 15).
- **Cards.** Every claim, said-once item and added-author item is one `li.claim` card with one border. `cardHead()` writes its label and, only while an added author is on, the names in the corner ("Aurelius", "Seneca").
- **Sentences.** `sentenceNode()` draws a sentence as components (`.sg`), each underlined with one coloured line per source passage. `sentenceSegs()` appends the clauses an added author contributes (`amend`), each with a small tag ("Seneca adds").
- **Voices.** `authors[]` in the record declares each added author once (name, reference prefix, mark, line pattern). `state.voices` holds which are on; the dock at the bottom switches them; `?with=seneca` keeps it in the link. The page has no author's name hard-coded.
- **Effects.** An added author's item has one of three effects. The keys in the data are `stronger`, `wider`, `qualified`; the page calls them **Backs**, **Adds**, **Challenges**. This plan uses the keys when it talks about data and the display names when it talks about the page.
- **Vectors column.** `mapBlock()`: three numbers, the map (`place()` fits the points to the box, `outline()` shades the section's ground), the key, a one-line readout (`readout()`), the nearest sections (`aroundBlock()`), then two folded blocks (`mapNotes()` and the full similarity table).

## 2. Decisions the owner must make first

The owner answers these in the message that starts a run. Where the message says nothing, use the default, which is always the cautious choice. Do not ask again mid-run.

| # | Question | Default if the owner says "your call" | Blocks |
|---|---|---|---|
| D1 | May the run commit? May it push? | Neither: leave everything uncommitted and say so in the report | W0, and the per-article commits in W3 |
| D2 | Spending cap for embedding the new articles' own sentences (about 30 sentences per article, about 25 tokens each, $0.13 per million tokens) | $0.05 for all 33 articles; never exceed without asking | W4 |
| D3 | Which countries must the Seneca translation be free in? (See W5.) | Treat the site as worldwide: finish W5 before publishing more Seneca | W5 |
| D4 | Article 1 was approved as written. May its two compressed phrases be expanded? | Leave Article 1 untouched | W8.2 |
| D5 | Review rhythm for new articles | Stop after every chapter for the owner's verdicts | W3 |
| D6 | Commit `AGENTS.md` (repo root) to git? | Leave untracked | W0 |

## 3. Rules that never bend

1. **Never quote from memory.** Every quote is copied from the output of the helper in W1 (Marcus) or from `candidates.json` / the Seneca corpus (Seneca). The build rejects a quote that is not exactly one span of the passage. If the build says a quote matches 0 times, the quote is wrong; do not "fix" it by guessing.
2. **Never push, and never commit, unless the owner said so** (D1). Pushing to `main` deploys the public site through Vercel. Pushing needs the owner account: see the owner's note "push as owner account"; the plain `git push` fails with 403.
3. **No paid call outside D2.** The only paid call in this plan is `scripts/aurelius-seneca.py embed`, and it always runs with `--token-budget` and `--cost-budget-usd`. Run `preview` first and report the number.
4. **Private text stays private.** Nothing under `.aurelius/` is copied into a tracked file except what the build itself publishes: the full text of Marcus's passages in sections that have an article, and the full text of only those Seneca sections that are quoted.
5. **Follow the writing rules.** Read all of `apps/aurelius/prompts/constitution-article.md` before writing an article. Rules 1 to 15 are the owner's corrections; breaking one repeats a mistake already made.
6. **Feedback becomes a rule.** When the owner comments on any article or on the page, add a general rule with the date and their words to that prompt file, then apply it to every article, not only the one named.
7. **Phone first.** The owner reads mainly on a phone. Every page change is checked at 360, 390 and 1440 px wide, light and dark, before it is called done (W1 gives the script).
8. **Plain words.** Articles are first person, declarative, modern English. No compressed or aphoristic phrasing, no invented metaphors, no "thou". If a phrase needs a second reading, expand it.
9. **Report honestly.** If a check fails, say so and show the output. If something was skipped, say that.
10. **Marcus's words are never rewritten for another author.** What an added author adds, changes or challenges is appended as a marked clause (`amend`, W4) and vanishes when that author is switched off.
11. **Repo preflight.** Before meaningful work run `.codex-memory/context --task "<task>" --path <file>` and read what it lists. After meaningful work record a fact with `.codex-memory/memory create --kind change --text "..." --evidence <path>` (it is slow; run it in the background; it takes no repo argument).

## 4. Commands

Run everything from the repo root, `/Users/ilyaperepelitsa/PycharmProjects/ilyadays`.

```bash
# Python with numpy, scipy, scikit-learn, playwright, openai, tiktoken:
PY=apps/aurelius/.venv/bin/python

$PY scripts/aurelius-constitution.py                 # validate the authored record and write the public JSON
node --test tests/aurelius/constitution.test.mjs tests/aurelius/composition-study.test.mjs
npm run typecheck                                    # only matters if a file under src/ changed
npx next dev -p 3170                                 # then open http://localhost:3170/apps/stoic-constitution.html
npm run build                                        # the production build Vercel runs; stop the dev server first (both use .next)

$PY scripts/aurelius-seneca.py preview               # tokens and cost of what is not yet embedded; no request is made
$PY scripts/aurelius-seneca.py embed --review-import --allow-openai --token-budget 20000 --cost-budget-usd 0.01
$PY scripts/aurelius-seneca.py attach                # writes .aurelius/corpora/seneca-gummere-wikisource/candidates.json
```

Useful page links: `?with=seneca` switches Seneca on; `?at=3.c2` opens Article 3's claim `c2`; `?without=3:4.36,9.26` removes passages.

What the build's error messages mean:

| Message contains | Cause | Fix |
|---|---|---|
| `quote matches 0 times` | The quote is not in that passage word for word | Copy it again from the helper output. Curly apostrophes (’) and dashes must match. A quote may not cross from one passage into another. |
| `quote matches 2 times` | The words occur twice in the passage | Make the quote longer until it is unique |
| `is not in the fused claim` / `is not in the sentence it backs` | A `gives` phrase is not a substring of the sentence | Make `gives` an exact substring of `t` (letter case is ignored) |
| `a fused claim needs at least two passages` | All quotes of a claim come from one passage | Add a second passage, or move the item to `single` |
| `every unused member needs a reason; mismatch {...}` | `aside` does not list exactly the section's unused passages | Add or remove keys in `aside` so they equal the set shown |
| `sits under exactly one label; mismatch` | A claim or single id is missing from `groups`, or listed twice | Fix `groups` |
| `groups follow the fixed labels` | `groups` keys are not `why, action, practice, breaks, doubt` in that order | Fix the keys; an empty label is an empty list plus a sentence in `empty` |
| `needs 6 passage colours; the palette has five` | Too many passages meet one another across claims | See W3 step 9 |
| `statement part` | A statement part's words are not in the statement, or an id does not exist | Fix `statement.parts` |
| `Seneca piece` | The id is not of the form `S<letter>.<section><a-z>`, or is used twice | Fix the id |
| `amend target` | A clause's `target` is neither `statement` nor a claim id of this article | Fix `target` |
| `an added clause continues the sentence and carries no full stop` | The clause's `t` does not start with a space, comma or semicolon, or ends with a full stop | Start with `, ` or ` — ` and drop the final full stop; the page adds it |
| `amend ids … are not among this author's pieces` | A clause cites a quote id that no item of that author in this article has | Cite the id of an existing item's quote, or add the item first |

## 5. Order of work, and the milestones

```
W0 park and tidy ──► W1 tools ──► W2 page for 38 articles ──► W3 articles 6–38 ──► W4 Seneca per article
                         │                                        ▲
                         └──► W6 map, W7 review tools ────────────┘ (any time after W1)
W5 translation rights: start at once, in parallel; must finish before more Seneca text is published
W8 wording fixes, W9 failing tests, W10 second author: independent, after W1
```

One milestone per run. Each ends with the owner's review, so a later milestone starts from their verdicts.

| Milestone | Contains | Stops for |
|---|---|---|
| **M1 Foundations** | W0, W1, W2, then Article 6 with its Seneca part (W3 + W4), which completes chapter 1 | Review of Article 6 and of the page with chapter navigation |
| **M2 Rights** | W5.1 to W5.3 (research and record; needs web access). W5.4 only if the owner picks another rung | The owner's choice of rung. Until then, M3 onward write `voices.seneca` but the run does not push |
| **M3 Chapter 2** | The full reading of the chapter (W3 step 1), then Articles 7 to 18 one at a time (W3 + W4). If the run is long, stop after Article 12 with a report and continue in a second run | Review of the chapter |
| **M4 Chapter 3** | Articles 19 to 26 | Review of the chapter |
| **M5 Chapter 4** | Articles 27 to 31 | Review; Article 29 may end as a question, not an article |
| **M6 Chapters 5 and 6** | Articles 32 to 36 | Review |
| **M7 Chapter 7** | Articles 37 and 38 | Review |
| **M8 Page** | W6 (map), W7 (review tools). May run any time after M1, between chapters | The owner tries the review tools on a phone |
| **M9 Loose ends** | W8, W9, W10 | — |

Inside a milestone: finish a task, run its checks, write the three-line report (section 7), go on. Do not start a second article before the first builds, passes and has been looked at.

---

## W0. Park and tidy

**W0.1 Commit the uncommitted work** (only if D1 allows a commit; otherwise do steps 1 and 2 and go on).

1. Stop the dev server if it is running. Run `npm run build`. It must finish with the route list and no error.
2. Run the constitution tests (section 4). 19 pass, 0 fail.
3. Stage everything except the tool cache and `AGENTS.md`: `git add -A -- . ':!.serena' ':!AGENTS.md'`.
4. Scan the staged files for secrets: `git diff --cached --name-only | xargs grep -lIE "gmail\.com|sk-[A-Za-z0-9]{20}|ghp_[A-Za-z0-9]{20}|eyJhbGciOi"` must print nothing. Note that `$VAR` holding a file list is not word-split in zsh; use `xargs` as shown.
5. Commit with a message that says what the reader gets (colour per passage, the vectors column, Seneca's items and clauses, the Voices dock). End the message with the attribution line the session gives you.
6. Push only if D1 says so.

**W0.2 Ignore the tool cache.** Add a line `.serena/` under "local project-memory tooling" in `.gitignore`. Check with `git status --short`: `.serena/` no longer appears.

**W0.3 `AGENTS.md`** (needs D6). If the owner says commit, `git add AGENTS.md` in the next commit. Otherwise leave it.

**Done when:** the production build and the tests pass, and (if D1 allowed it) `git status --short` shows nothing but possibly `AGENTS.md`.

## W1. Tools for the work ahead

**W1.1 Section reader.** Create `scripts/aurelius-section.py`. It prints everything needed to write one article, so that quotes are copied and never recalled.

```python
#!/usr/bin/env python3
"""Print one topic section for article writing: every passage in full, with its reference, rank and closeness.
Usage: apps/aurelius/.venv/bin/python scripts/aurelius-section.py c3.s1 [--seneca]
Reads the private corpus under .aurelius/. Prints to the terminal only; writes nothing."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / '.aurelius/corpora/casaubon-gutenberg-2680-6977474f82a39dd8-numbered-text-v2-d436fea5/corpus.json'
topics = json.loads((ROOT / 'content/aurelius/topics.json').read_text())
authored = json.loads((ROOT / 'content/aurelius/constitution.json').read_text())
sid = sys.argv[1]
chapter, section = next((c, s) for c in topics['chapters'] for s in c['sections'] if s['id'] == sid)
names = authored['chapters'][chapter['id']]
text = {p['revision_id']: p['text'] for p in json.loads(CORPUS.read_text())['passages']}
print(f"SECTION {sid} · {names['sections'][sid]} · chapter “{names['title']}” · {section['size']} passages · cohesion {section['cohesion']}\n")
for rank, m in enumerate(section['members'], 1):
    print(f"[{m['reference']}] rank {rank} · closeness {m['similarity']} · {m['words']} words\n{text[m['revision_id']]}\n")
if '--seneca' in sys.argv:
    report = json.loads((ROOT / '.aurelius/corpora/seneca-gummere-wikisource/candidates.json').read_text())
    article = next((a for a in report['articles'] if any(x['section'] == sid and x['number'] == a['number'] for x in authored['articles'])), None)
    if not article:
        sys.exit('No candidates yet: write the article, embed its sentences, run attach (W4).')
    print(f"SENECA CANDIDATES for Article {article['number']} ({len(article['candidates'])}); nearest-section count {article['seneca_nearest_this_section_raw']}\n")
    for c in article['candidates']:
        print(f"[{c['ref']}] best for {c['best']} at {c['best_raw']} · found by {', '.join(c['for'])}\n{c['text']}\n")
```

Check: `$PY scripts/aurelius-section.py c6.s6` prints six passages, the first being 10.22. `$PY scripts/aurelius-section.py c6.s1 --seneca` prints Letter 95.52 first.

**W1.2 Browser check script.** Create `scripts/aurelius-constitution-check.py` (Playwright, headless). It must: open the page at 360×740 dark, 390×844 light and 1440×1000 light, with and without `?with=seneca`; collect console errors and page errors; open every third "Show the quotes" button; at 1440 px hover every `.sg[data-refs]` and every `svg.map .pt` (a hover once threw an error that no click found); and print for each run: horizontal overflow in px (`document.documentElement.scrollWidth - clientWidth`, must be 0), count of text elements with computed font size under 12 px (must be 0), count of visible buttons shorter than 40 px (must be 0; skip elements with `offsetParent === null`), number of articles rendered, and the error list (must be empty). At 1440 px also check the layout rule: for every article, the top of `.grps` is within 40 px of the bottom of `.lead-col` (the vectors column does not push the sides down), and with the sides scrolled into view the `.sci` column is still on screen. Exit code 1 if any number is wrong. The dev server must be running on port 3170; the script takes `--port`.

The page sets `scroll-behavior: smooth`. In a test, scroll with `window.scrollTo({top, behavior: 'instant'})`, or measurements are taken mid-animation.

Check: the script exits 0 on the current page.

> **Amended 23 Nov 2026 (G4).** The small-section rule below let a statement part have no witness at all. Corrected: every statement part needs at least one quoted piece in any section, at least one part rests on two passages, and in a section of five or more passages every part does. Shared components are now tested per article with no exempt list (G1).

**W1.3 Tests that assume five articles.** In `tests/aurelius/constitution.test.mjs` change exactly these, and nothing else:

| Test | Now | Change to |
|---|---|---|
| `every chapter and section has a name, and exactly the first chapter was named from a full reading` | first chapter `read: 'full'`, others `'central'` | every chapter that has at least one article has `read: 'full'`; chapters without articles may be `'central'`. Rename the test to say so. |
| `five articles, one per section of the first chapter, each from its own section` | exactly 5 | articles are numbered 1..N without gaps; each has a different section; article order follows chapter `order`, then the section order inside `topics.json`. Rename. |
| `a fused claim rests on at least two passages…` | `article.claims.length >= 3` | at least 3 fused claims when the section has 8 or more passages; at least 1 when it has fewer |
| `each article makes one short statement…` | every part rests on 2 or more passages | keep; but for a section of fewer than 5 passages allow parts resting on one passage, and require at least one part resting on two |
| `Seneca is added…` | every article has `voices.seneca` with ≥3 stronger, ≥1 wider, ≥1 qualified | every article that has `voices.seneca` satisfies: at least 1 item; counts equal the items. Do not force a wider or a qualified item where Seneca has none. Leave the clause checks as they are: a clause is required only when there is a wider or a qualified item. |

Check: the tests still pass on the five existing articles.

## W2. The page for 38 articles

Today all articles are drawn in one list from one JSON file. With 38 articles that is about 2 MB and a very long page. Do this before writing Article 9 at the latest.

**W2.1 Split the data.** In `scripts/aurelius-constitution.py`:

- Keep `public/apps/stoic-constitution.json` as the index: everything it has now except `articles`, plus `articles` as stubs: `{number, section, chapter, title, statement: {t}, counts: {claims, single, sources, section_size}, voices: {<key>: {becomes, counts}}}`.
- Write one file per chapter that has articles: `public/apps/stoic-constitution/<chapter id>.json` = `{chapter, articles: [full articles]}`.
- The tests read the index and every chapter file and join them; add a small `load()` helper at the top of the test file so the existing assertions keep working on `record.articles`.

**W2.2 Chapter navigation.** In the page:

- State gains `chapter` (a chapter id; default the chapter of order 1). URL: `?c=c3`. `?at=7.c2` implies the chapter of Article 7.
- The sticky top bar (`.bar`) shows the article numbers of the current chapter only, plus a chapter picker: on a phone a `<select>`-like button that opens a list of the seven chapters with their article counts; on wide screens the seven chapter names as tabs if they fit, else the same button.
- Load a chapter file when its chapter is first opened (`fetch`), keep it in a `Map`, show a one-line "Loading chapter…" while waiting, and an error line with a retry button if it fails.
- The topic tree at the top links each section that has an article to `?c=<chapter>#article-<n>`.
- "Your verdicts" lists all written articles grouped by chapter; it reads titles from the index so it needs no chapter file.
- The Voices dock, removed passages and open panels keep working per chapter. Switching chapter clears `state.sel` and keeps `state.voices`.

**W2.3 Checks.** The browser check (W1.2) visits `?c=` for every chapter that has articles. No overflow, no small text, no errors. Loading the page with a slow network profile (Playwright `route` delay of 1 s on the chapter file) shows the loading line, then the articles.

**Done when:** five articles look and behave exactly as before (compare screenshots of Article 1 at 390 and 1440 px, Seneca on, taken before and after), the index is under 60 KB, and adding a chapter needs no page change.

## W3. Articles 6 to 38

### The list

Numbers are fixed now so that links stay stable. "Size" is the number of passages in the section. Notes give what to expect; they are hints, not conclusions.

| No. | Section | Title (provisional outside chapter 1) | Size | Note |
|---|---|---|---|---|
| 6 | c6.s6 | What the whole sends in its season | 6 | Last of chapter 1. Small: W1.3's small-section rules apply. |
| 7 | c3.s1 | Opinion is in my power | 10 | Chapter 2 "The life within" starts. Do the full reading of the chapter first (step 1 below). |
| 8 | c3.s2 | Nothing happens that a human being cannot bear | 19 | Large. Expect 4 to 5 claims and several passages set aside. |
| 9 | c3.s3 | Gravity, and keeping the names I have taken | 8 | |
| 10 | c3.s4 | Living now as one about to die | 18 | Large. Near neighbour of Article 3; do not repeat Article 3's claims. |
| 11 | c3.s5 | Falling short and beginning again | 16 | Likely rich under "When it breaks". |
| 12 | c3.s6 | The retreat within | 12 | Seneca's Letter 7 and 28 are relevant; expect a real "Qualified". |
| 13 | c3.s7 | Whether anything is better than virtue | 14 | Border with Article 2 (7.30 sits between them). |
| 14 | c3.s8 | Living with the gods | 5 | Small. |
| 15 | c3.s9 | What is not in my power | 8 | |
| 16 | c3.s10 | The good spirit within | 5 | Small. |
| 17 | c3.s11 | Ready to leave | 10 | |
| 18 | c3.s12 | Content wherever I am put | 8 | |
| 19 | c2.s1 | When someone offends me | 20 | Chapter 3 "Daily conduct". Largest section. Likely strong "Practice". |
| 20 | c2.s2 | Taking a thing apart: matter, form and end | 6 | Small; a method, so "Practice" may hold the fused claim. |
| 21 | c2.s3 | Clearing away opinion and impulse | 12 | |
| 22 | c2.s4 | Being good for its own sake | 17 | |
| 23 | c2.s5 | Keeping to one's craft | 3 | Very small. One fused claim at most; say in `limit` that three passages cannot carry more. |
| 24 | c2.s6 | Training, and the use of reason | 7 | |
| 25 | c2.s7 | Returning to myself | 8 | |
| 26 | c2.s8 | The morning, and the question before each action | 12 | |
| 27 | c7.s1 | Whose praise do I want? | 13 | Chapter 4 "Other minds, fame and harm". |
| 28 | c7.s2 | Wrongdoing harms the wrongdoer | 7 | |
| 29 | c7.s3 | Short sayings | 5 | Loosest section in the book (cohesion 0.64) and the farthest from everything. It may not be one topic. If the five passages share no claim, write the article as five "said once" items with one honest statement, or propose to the owner to leave it without an article. Do not force a fusion. |
| 30 | c7.s4 | The sameness and meanness of things | 12 | Loose (cohesion 0.63). Read all twelve before trusting the name. |
| 31 | c7.s5 | The reasonable soul and its powers | 18 | Near Articles 1 and 4. |
| 32 | c4.s1 | All things pass | 15 | Chapter 5 "Change". |
| 33 | c4.s2 | The same matter, reshaped | 8 | |
| 34 | c5.s1 | The dead and the forgotten | 17 | Chapter 6 "Death and time". Many lists of names; quote the claim, not the list. |
| 35 | c5.s2 | The shortness of life | 8 | |
| 36 | c5.s3 | Meeting death well | 8 | |
| 37 | c1.s1 | What I learned, and from whom | 10 | Chapter 7 "Teachers and examples". Book 1 is thanks, not rules. Turn "from X I learned Y" into "I shall Y" only where Marcus states the lesson; name the teacher in `follows`. "If I doubt it" will be empty. |
| 38 | c1.s2 | Socrates, Plato and other models | 14 | Quotations and anecdotes. Much may be set aside. |

Chapter order is editorial and fixed in `chapters.<id>.order` of the authored record. Do not re-cluster and do not move passages between sections. If a passage plainly belongs elsewhere, say so in `aside` or in `limit`; the neighbours panel will show the border.

### The procedure, for one chapter

**Step 1. Read the whole chapter once** (only when starting a chapter). Run the section reader for each of its sections. Then, in `content/aurelius/constitution.json` under `chapters.<id>`: confirm or rewrite the chapter `title` and `summary` and every section title, and set `"read": "full"`. A title is a short plain noun phrase or sentence that fits every central passage. Report each title you changed and why, in one line each.

> **Amended 23 Nov 2026.** Three steps are added to the procedure below, from the second review (article prompt, rules 18 to 20):
> - **After finding parallels:** for each fused claim, name the words that two of its passages both say. If there are none, it is not a fused claim; make the points said-once items. Never map a passage to words it does not say in order to raise the share: correct such mappings even when the share falls.
> - **After writing the statement:** every "so", "therefore" or "because" that no passage says goes into `inferences` with one sentence of why it is the editor's.
> - **Where the project's translation of the section exists:** set `"edition": "project-v1"` and quote that English; the build then checks quotes against it and the page shows the Greek and Casaubon on request.

### The procedure, for one article

Do one article at a time, start to finish. Do not write two articles in one edit.

**Step 2. Read.** `$PY scripts/aurelius-section.py <section>`. Read every passage in full. For each passage note, in your working notes only, the separate things it says.

**Step 3. Find parallels.** Look for the same thing said in two or more passages, in different words or images. Each such group becomes one fused claim. Aim for 3 to 5 claims in a section of 8 or more passages. A group needs quotes from at least two different passages.

**Step 4. Write each claim.** For a claim write:

- `id`: `c1`, `c2`, … in the order written.
- `role`: two to five words naming what the claim does ("What we are", "The way back").
- `t`: one or two plain first-person sentences. Prefer wording in which a component is said by two or more passages.
- `shared`: one or two sentences saying what the passages have in common.
- `changed` (optional): what the fusion generalised or dropped.
- `support`: one entry per quote: `id` (reference plus a letter: `8.45a`, `8.45b`; letters restart per passage and are unique within the article), `quote` (exact, copied), `gives` (a list of exact substrings of `t` that this quote backs; one quote may back several; map a quote to every component its words really say and to none they do not), `follows` (one plain modern sentence saying what follows from this passage alone, ending with a full stop, under 170 characters, no "thou/thee/thy/doth/hath"), and optionally `note` (use only when the quote backs the claim as a whole and no particular words; then `gives` may be omitted).

**Step 5. Write the single-witness items.** What only one passage says, and is worth keeping, goes in `single`: `id`, `label` (two or three words: "A practice", "A warning"), `t` (plain first person), `quote`, `why` (why it is not fused: usually "Only <ref> says this"), `follows`.

**Step 6. Place everything under the five labels.** `groups` has exactly the keys `why`, `action`, `practice`, `breaks`, `doubt`, in that order. Each claim id and each single id appears under exactly one. For each label with nothing under it, add a sentence under `empty.<label>` saying that no passage in this section does that. Never fill a label with words that have no quote.

| Label | Holds |
|---|---|
| `why` | The ground for the statement |
| `action` | What follows for what I do |
| `practice` | An exercise I can repeat |
| `breaks` | What failing looks like, and the way back |
| `doubt` | What still holds if the statement is not true |

**Step 7. Write the statement.** One sentence, 30 to 140 characters, first person, that the claims support. Then `parts`: split the statement into two to four components and give each the ids of the quotes behind it; each part should rest on two or more different passages (the small-section exception is in W1.3). Add `kind` (a short name for how the claims fit together: "A chain of consequences", "Lists aligned into one", "An argument by cases", "A likeness", "A rule and its hardest case", or another plain phrase) and `form` (one to three sentences explaining that fit; this is the only place for talk about the passages themselves).

**Step 8. Account for the rest.** `aside` maps every passage of the section that is not quoted to one sentence saying why (off the topic, a repeat that adds nothing, an anecdote, belongs with another section). `decisions` lists two to four things the editor chose that a reader might dispute. `limit` says in one to three sentences where the article is weak.

**Step 9. Build.** Run the build. Fix every error using the table in section 4. If it says the palette is exceeded: the same passages are being quoted in too many claims together. Check first whether a passage is quoted in a claim where another passage says the same thing better, and drop the weaker quote; if two claims share nearly all their passages, merge them. Do not change the palette or the limit of five.

**Step 10. Test and look.** Run the tests. Run the browser check. Then open the article on a phone-sized window and read it as a stranger would: does the statement sound like an article of a constitution? Does every sentence make sense on first reading? Open each "Show the quotes" and check that the right-hand "what follows" really follows from the left-hand passage. On a wide window look at the vectors column: are the passages you fused near one another, and does the nearest-sections list name an article whose claims you may have repeated?

**Step 11. Seneca.** Do W4 for this article.

**Step 12. Record.** Add a dated paragraph to `docs/aurelius/implementation-log.md` only at the end of a chapter, not per article. Commit per article if D1 allows local commits.

### The shape of an entry

A trimmed real entry (Article 1). New articles follow it exactly; `number` and `section` come from the table above.

```json
{
 "number": 1, "section": "c6.s1", "title": "A member of one body",
 "statement": {
  "t": "I am a member of one body of reasoning beings, made for a shared life with them.",
  "parts": [{"words": "a member of one body", "ids": ["7.10a", "7.10c", "9.21a"]},
            {"words": "of reasoning beings", "ids": ["9.7a", "12.23b"]}],
  "kind": "Many pictures, one claim; then its consequences",
  "form": "The statement gathers claims 1 and 2. Each of those is fused from four passages that use different pictures."
 },
 "claims": [{
  "id": "c1", "role": "What we are",
  "t": "Everything that reasons shares one reason, as limbs share one body, citizens one city, and every lit place one sun.",
  "shared": "Four pictures (body, city, sunlight, soul) with one structure: a single thing present in many, and not split by being shared.",
  "support": [
   {"id": "7.10a", "quote": "As several members in one body united, so are reasonable creatures in a body divided and dispersed",
    "gives": ["as limbs share one body", "Everything that reasons"], "follows": "Reasoning beings relate to one another as the parts of one body do."},
   {"id": "4.4a", "quote": "If so, then the world is as it were a city.", "gives": ["citizens one city"],
    "follows": "Because reason is common to all, all people are fellow citizens of one city."}]
 }],
 "single": [{"id": "7.10c", "label": "A practice", "t": "I shall often say to myself: I am a member, and not merely a part.",
  "quote": "use thyself often to say to thyself, I am μέλος, or a member of the mass and body of reasonable substances",
  "why": "Only 7.10 gives an exercise. It is kept as the article’s practice.", "follows": "I should often tell myself that I am a member of this body."}],
 "groups": {"why": ["c1", "c2"], "action": ["c3"], "practice": ["7.10c"], "breaks": ["c4", "c5", "11.7f"], "doubt": []},
 "empty": {"doubt": "No passage in this section considers that reasoning beings might not be one. The doubt is taken up under Article 3."},
 "decisions": ["Reads body, city, sunlight and soul as four pictures of one claim. Marcus never lines them up himself."],
 "limit": "Nine of the ten passages feed the article. That is also a risk: fusing smooths over differences.",
 "aside": {"8.52": "<one sentence>"},
 "voices": {"seneca": { "…": "see W4" }}
}
```

The build numbers the claims in reading order (label by label), so write "claim 1", "claim 2" in `form`, `decisions` and `limit` by that order, and check the numbers on the page after building.

### Quality bar, checked per article

- The statement is under 140 characters and every part of it has quotes.
- No sentence restates a single passage while claiming to be fused.
- At least a third of the claim components across the article rest on two or more passages (the test checks this over all articles; keep each article near that).
- Every passage of the section is quoted or has an `aside` reason.
- No label is filled without a quote; empty labels say why.
- Every `follows` can be checked against its passage alone.
- Nothing in an article repeats a claim of an earlier article in different words. If two sections overlap, say so in `limit` and name the other article.

### When to stop and ask

- A section does not hold together as one topic (Article 29 is the likely case).
- Two sections would produce the same statement.
- A title confirmed from the full reading differs in meaning from the provisional one.
- The owner's review (D5) is due: after Article 6, then after each chapter.

> **Amended 23 Nov 2026 (G2, G7, G8; article prompt rules 16 to 18).** Before the steps of W4 below: search the letters by the section's own key words and log it in `searched` (words searched, each passage rejected and why). For every piece: read the letter around the quote and write `context`; a piece whose context is about something else is not used. Every clause names its items in `from`, cites only their quotes, says no more than they say, and is marked "challenges" only for a real disagreement. The build rejects a voice without a search log and a piece without its context.

## W4. Seneca for each new article

Do this after the article's Marcus part builds and passes. What the owner asked for: the reader is told "if you add Seneca, this article becomes …", sees which bits are whose by one quiet mark, and sees Seneca's additions **inside the article's own sentences** when he adds, changes or challenges something.

1. `$PY scripts/aurelius-seneca.py preview`. Under `article_sentences` it shows the uncached sentences and their cost. Check the running total against D2.
2. `$PY scripts/aurelius-seneca.py embed --review-import --allow-openai --token-budget <preview tokens + 20%> --cost-budget-usd <preview cost, rounded up to a cent>`. The letters are already cached, so only the new sentences are sent.
3. `$PY scripts/aurelius-seneca.py attach`. Then `$PY scripts/aurelius-section.py <section> --seneca`.
4. Read the candidates. The vectors are a net, not a judge: about half of what they return is off the point, and some of the best passages rank low. Also look for passages you know should exist by searching the corpus for words (a short Python loop over `.aurelius/corpora/seneca-gummere-wikisource/corpus.json`, matching `p['text']`); copy the text from there.
5. Write the **items** in `voices.seneca.items`, each exactly one of:
   - **stronger** (page: Backs): `{"effect": "stronger", "claim": "<claim id>", "id": "S<letter>.<section><a-z>", "quote": "…", "gives": ["<substring of that claim's t>"], "follows": "…"}`. Use it only when Seneca's words say what those words of the claim say.
   - **wider** (page: Adds): `{"effect": "wider", "label": "<label key>", "key": "w1", "role": "…", "t": "<plain first-person sentence>", "why": "<what Marcus lacks here>", "support": [{"id": "S…", "quote": "…", "follows": "…", "gives": ["<substring of t>"]}]}`. Prefer labels Marcus leaves empty. `gives` may be omitted when one quote backs the whole sentence; with two or more quotes give each its `gives`.
   - **qualified** (page: Challenges): `{"effect": "qualified", "claim": "<claim id>", "key": "q1", "t": "<what Seneca says differently, and where he is inconsistent with himself>", "support": [{"id": "S…", "quote": "…", "follows": "…"}]}`. Record a real difference only. Do not invent one to fill the slot; an article may have none.
   - Ids: `S95.52a` means Letter 95, section 52, first quote. The same id may appear in two articles but not twice in one.
6. Write the **body clauses** in `voices.seneca.amend`. A clause is a few words appended to the statement or to one claim while Seneca is on. Marcus's `t` is not edited (section 3, rule 10).

   ```json
   "amend": [
    {"target": "statement", "kind": "adds", "t": ", each of us holding the others up as the stones of an arch do", "ids": ["S95.53a"]},
    {"target": "c4", "kind": "challenges", "t": " — though stepping back from the crowd to keep better company is not cutting myself off", "ids": ["S7.8a"]}
   ]
   ```

   | Field | Rule |
   |---|---|
   | `target` | `statement`, or the id of a claim. One clause per target at most. |
   | `kind` | `adds` (he supplies something the sentence lacks), `changes` (with him the sentence means something different), `challenges` (he limits it or disagrees). The page shows the tag "Seneca adds / changes / challenges". |
   | `t` | Continues Marcus's sentence so that the two read as one: starts with `, ` or ` — `, plain first person, 20 to 140 characters, no full stop at the end. Read the joined sentence aloud; if it does not parse, rewrite the clause. |
   | `ids` | Ids of Seneca quotes that already appear in this article's items. A clause with no quote behind it is not allowed. |

   When to write one: for the **statement**, when a wider item changes what the article as a whole says (kind `adds` or `changes`); for a **claim**, when a qualified item limits it (kind `challenges`, citing that item's quote). A stronger item never produces a clause: backing is shown by the dotted line under the words and the "+ Seneca" chips. If Seneca has a wider or a qualified item in the article, at least one clause must exist (the test checks this). Two or three clauses per article is typical; do not attach one to every claim.
7. Write the two sentences of the strip:
   - `becomes`: shown while Seneca is off. One or two sentences beginning "With Seneca, …": which claims gain a witness, which labels gain something, what is challenged.
   - `statement`: shown while Seneca is on. One sentence saying how the statement changed ("With Seneca the statement gains the arch: we do not only belong together, we hold one another up."), or that it stands unchanged.
8. Build, test, browser check with `?with=seneca`. Then look: the statement and the amended claims show the tagged clause with Seneca's dotted line; each card touched by Seneca has his name in its corner; tapping Backs / Adds / Challenges in the strip scrolls to and flashes the right cards; switching Seneca off in the dock removes every clause and name and leaves the reader at the same place.

**Done when:** the strip states what the article becomes, every Seneca item opens to an exact quote with "what follows", and every clause reads as part of its sentence.

## W5. Translation rights, with fallbacks

The Seneca text in use is Richard Mott Gummere's Loeb translation (three volumes, 1917, 1920, 1925), taken from English Wikisource. The site publishes only quoted sections of it, but it is public.

What is believed, **from memory and not verified**: Gummere died in 1969. If so, his translation is free in the United States (published before 1931) but stays protected until the end of 2039 in countries that count 70 years from the translator's death, which includes the EU, the UK and Turkey.

**W5.1 Verify.** Find and record, with the source of each fact: Gummere's year of death; the publication year of each volume; the rule in the countries named by D3. Write the result in a new section "Rights" at the top of `scripts/aurelius-seneca.py`'s docstring and in `authors[0]` of the authored record as `rights: {basis, free_in, checked_on, sources: [...]}`. This is a factual record for the owner, not legal advice; the owner decides.

**W5.2 The mechanical rule.** A translation is treated as free everywhere when its translator died more than 100 years ago, and free in life-plus-70 countries when the translator died more than 70 years ago. Apply the same rule to every author added later.

**W5.3 Fallback ladder.** If W5.1 and D3 say Gummere cannot be used, move down this list. Each rung's facts are also from memory: verify the translator's dates and find a clean, complete text before relying on it.

| Rung | Translation | Believed status | Cost of switching |
|---|---|---|---|
| 1 | Gummere, Loeb 1917–1925 (current) | Free in the US; protected to 2039 in life+70 countries | none |
| 2 | Thomas Morell, *The Epistles of Lucius Annaeus Seneca*, 1786, two volumes | Translator died 1784: free everywhere | Scans only (archive.org, Google Books); 18th-century type with long s; no Loeb section numbers |
| 3 | Thomas Lodge, *The Workes of Lucius Annaeus Seneca*, 1614 (revised 1620) | Translator died 1625: free everywhere | A transcription exists in the Early English Books text collections; archaic spelling; no section numbers |
| 4 | The Latin text (an edition before 1929, for example Hense's Teubner text of 1898/1914) with the editor's own English beside it | Seneca's Latin is free everywhere; our translation is ours | Quotes become Latin spans; every quote needs our translation, labelled as the editor's |

Roger L'Estrange's *Seneca's Morals* (1678) is free everywhere but is a rearranged abstract, not the letters one by one; it cannot give letter and section references and is not on the ladder.

For Marcus the text in use is Meric Casaubon's (1634; he died in 1671), free everywhere. If it ever had to be replaced, George Long's translation (1862; Long died in 1879) is the fallback.

**W5.4 How to switch edition** (the same steps serve for adding a second translation beside the first):

1. Give the edition its own id and folder: `.aurelius/corpora/seneca-<translator>-<source>/` and raw pages under `.aurelius/imports/…`. Never overwrite the Gummere folders.
2. In `scripts/aurelius-seneca.py` make the edition a parameter (`--edition gummere|morell|lodge|latin`), each with its `EDITION` record, fetcher and parser. For an edition without Loeb section numbers split letters into paragraphs and number them in order; references read `Ep. 95 ¶12`. Build a crosswalk file `sections.json` mapping each paragraph to the Loeb section it mostly overlaps, by embedding similarity to the Gummere sections within the same letter, so existing items can be found again.
3. Parse, inspect (`inspection.json` must show 124 letters and no `empty_section`, `duplicate_section` or `no_sections` warning), preview the cost (a full corpus is about 250,000 tokens, about $0.03), get the owner's approval for that paid call, embed, write arrays.
4. Re-quote every existing Seneca item: for each item find the matching passage through the crosswalk, copy the new exact words that say the same thing, and rewrite `follows` only if the new words say something different. If the new translation does not say it, drop the item and note it in the log. The build will reject every quote that was not replaced, which is the checklist.
5. Record the edition in `authors[0]` (`translator`, `source`, `rights`). The page reads names from there; no page change is needed.
6. For rung 4 only: pieces carry `quote` (Latin, exact) and `english` (the editor's translation); the page shows both and labels the English "editor's translation". This needs a small page change in the quoted row and the hover card, and a rule in the prompt file that the English must be literal.

**Done when:** `authors[0].rights` is filled from verified sources, the owner has chosen a rung, and if the rung is not 1 every Seneca quote on the page comes from the chosen edition.

## W6. The vectors column

Already done on 23 November, do not redo: the vectors are a sticky column of their own; the map is fitted to its box; the section's ground is shaded (convex hull of Marcus's dots, `outline()`); three headline numbers; the one-line readout under the map; the compact nearest-sections list; explanations folded; an added author's labels show only on hover or focus.

One constraint governs everything below: at 1440×900 the column's content down to and including the nearest-sections list must fit on screen (today it is about 820 px). Whatever is added goes into a folded block or replaces something.

**W6.1 An added author's marks say what the passage does.** Today all of Seneca's passages are filled black squares. In `mapBlock` and the CSS of `svg.map`:

| What | Marcus | Added author |
|---|---|---|
| Shape | circle | the author's `mark` from `authors[]` (`square`, `diamond`, `triangle`) |
| Feeds a claim | filled with the passage's colour, card-coloured ring | — |
| Set aside | hollow, grey outline | — |
| **stronger** item (Backs) | — | filled black |
| **wider** item (Adds) | — | hollow: card-coloured fill, 2 px black outline |
| **qualified** item (Challenges) | — | hollow with a diagonal black stroke through it |
| Tie | grey line between passages fused in one claim | dotted black line to the nearest Marcus passage; opacity scales with similarity (0.35 at the lowest similarity in the article, 0.9 at the highest) |

A passage used in two effects takes the first of stronger, qualified, wider. Extend the key under the map with one entry per mark actually present; the key's text stays in ink.

**W6.2 How unusual is this closeness.** Inside the folded block "How to read these numbers" (`mapNotes()`), when a voice is on, add one small strip per added author: a horizontal axis from the lowest to the highest similarity that any of that author's passages has to this section's centre; a thin grey histogram of all the author's passages (the build adds `voices.<key>.spread: {min, max, bins: [20 counts]}`); and one black tick for each passage quoted in this article, with its reference on hover and focus. Caption: "Where the quoted passages sit among all 2,140: further right is closer to this section." It shows honestly which quotes the vectors found and which were found by reading. One axis only; no second scale.

**W6.3 Labels that do not overlap.** In dense sections (Articles 2 and 3) labels cover dots and each other. Replace the left/right rule with a greedy placement: for each dot, in order of closeness to the centre of the section, try eight positions for its label (right, left, above, below, and the four diagonals, 10 px away), measure overlap with every dot and every label already placed (use a text width of 7.2 px per character and a height of 14 px), and take the first position with no overlap. If none is free, take the position with the least overlap and hide the label until the dot is hovered, focused or picked. Check by screenshot at 390 px and 1440 px for Articles 2 and 3.

**W6.4 Checks.** After each of the three: the browser check passes, including its layout rule; colours still pass `node <dataviz skill>/scripts/validate_palette.js "<the five hex values>" --mode light --surface "#fffdf8" --pairs all` and the dark set with `--mode dark --surface "#1e2320"` (the hex values are in the log entry of 23 November); the map states its stress; nothing relies on colour alone.

## W7. Review tools for the owner

The owner said they will use the Keep/Revise/Drop buttons. Today they cover whole articles, save in the browser only, and have no notes.

1. **Per-item verdicts.** Add a small verdict control (three 40 px buttons, or one button that cycles Open → Keep → Revise → Drop) to: the statement; each claim; each single item; each added-author item (stronger pieces in their quoted row, wider cards, the "challenges this" note in the quotes panel); and each body clause. Keys: `a<number>`, `a<number>:statement`, `a<number>:<claim id>`, `a<number>:s:<id>`, `a<number>:<author>:<piece or item key>`, `a<number>:<author>:amend:<target>`. The control must not make a card bulkier (rule 14): one small button in the card's corner row that opens the three choices.
2. **Notes.** Next to any verdict that is Revise or Drop show a one-line text field (at least 44 px tall, 16 px font so iOS does not zoom). Save on input, debounced.
3. **Storage.** Keep `localStorage`, key `stoic-constitution:v2:review`, value `{verdicts: {key: 'Keep'|'Revise'|'Drop'}, notes: {key: text}}`. Read the old `v1` key once and carry article verdicts over. Wrap every read and write in try/catch.
4. **Export.** "Copy my review" produces plain text the owner can paste into a chat: one line per verdict that is not Open, grouped by article, each with the sentence it is about (first 80 characters) and the note. Also offer "Download as a file" (`stoic-review-<date>.txt`).
5. **Filter.** A switch "Only what I have not judged" hides items with a verdict, so the owner can work through the rest.
6. **When a review arrives.** For each Revise or Drop: fix that item; ask yourself what general rule the comment implies; add the rule with date and words to the prompt file; apply it to every article; tell the owner which other articles changed because of it.

**Done when:** on a phone the owner can mark a single quote's conclusion Revise, type why, and paste the whole review into a chat in one action.

## W8. Wording that is already known to be off

1. **The eight body clauses of Articles 1 to 5** were written on 23 November and the owner has not judged them. Ask for a verdict on each (W7 gives the tool; until then list them in a message). Article 5's is the one that `changes` the statement (the joy of doing the work); Marcus says something close in 8.25, which belongs to Article 2, so offer the owner the alternative of quoting 8.25 in Article 5 for Marcus alone.
2. **Article 1** has two compressed phrases: "nature is stronger than my leaving" (claim 5) and "what makes me one person" (claim 3). The owner approved Article 1 as it stood, so change nothing without D4. If allowed: "because my nature keeps drawing me back to the whole" and "and keeping that one aim is what keeps me the same person in everything I do"; then update the two `gives` phrases that quote those words (9.7c and 11.19b) and rebuild.
3. **Sweep all 109 `follows` sentences, the 44 Seneca items and the 8 clauses** once the owner's first review is in, applying whatever rules it produced.

## W9. The three failing tests

They fail in the pushed tree and are not part of the constitution work. Investigate; do not delete or weaken a test to make it pass.

| Test | File | What is known |
|---|---|---|
| `reading plan: the first chapter states recurring lessons as principles and each lesson is printed once` | `tests/aurelius/book.test.mjs`, about line 44; the failing assertion is near line 52 | Fails with a plain falsy assertion. The source under test is `src/lib/aurelius/book.mjs` and the Python twin `apps/aurelius/aurelius/book_study.py`, both edited in an earlier session. |
| `the shipped previous study upgrades additively and retains user revisions, decisions and selection identity` | `tests/aurelius/real-corpus.test.mjs`, about line 44; fails near line 52 | Expected 4, got 3. Probably a count of items in `content/aurelius/backup-study.json` after an upgrade step. |
| `relational seed uses the same versioned IDs and six-view prompt hashes as the offline compiler` | `tests/fitness/machine-specs.test.mjs` | Unrelated to Aurelius. May need a local database or generated file; read the test before assuming a bug. |

For each: run the single file with `node --test <file>`, read the assertion, find whether the code or the expectation is stale (use `git log -p --follow` on both), fix the stale side, and say in the report which side it was and why. If a fix needs a product decision, stop and ask.

## W10. A second added author (dry run)

Do this only after W5 is settled, to prove the "voices" design before the owner asks for it. Epictetus is the natural candidate; choose an edition by the rule of W5.2 (for example Elizabeth Carter's translation of 1758: translator died 1806, to be verified).

1. Corpus script: copy the pattern of `scripts/aurelius-seneca.py` into `scripts/aurelius-voice.py` with an author parameter, or generalise the existing script; one registry entry per author: edition record, fetcher, parser, reference prefix, id prefix.
2. Build: in `scripts/aurelius-constitution.py` replace the Seneca-only loading (the block that starts with the comment `Added authors ("voices")`) with a loop over `authored['authors']`, each loading `.aurelius/corpora/<folder>/corpus.json` and `vectors.npz`. Remove the assertion that only Seneca exists. Compute `author_gap` per author.
3. Record: add the author to `authors` with a new `reference_prefix`, `id_prefix`, `mark` (`diamond`) and `line` (`dashdot`); add `voices.<key>` to two articles as a trial.
4. Page: nothing should need changing. Check that the dock shows three voices and scrolls sideways on a 360 px screen, that two voices can be on together, that a claim backed by both shows both line patterns, both groups of chips and both names in its corner, that a sentence amended by both carries both clauses in the order of `authors[]` and still reads as one sentence, and that the map shows both marks. Fix whatever does assume one author.
5. Tests: generalise the Seneca test to loop over `record.authors`.

## 6. Risks to watch

| Risk | Sign | What to do |
|---|---|---|
| Fused claims drift into paraphrase of one passage | A claim whose `gives` phrases all come from one quote | Rework or move to `single` |
| Articles repeat one another across neighbouring sections | The neighbours panel shows similarity above 0.88 and the statements read alike | Say it in `limit`; make each statement about what its own section adds |
| Quotes copied wrongly | Build errors about matches | Copy again; never retype |
| The page slows down on a phone | Chapter file over 600 KB, or first draw over 2 s on a mid-range phone | Do not embed full passage text for set-aside passages; load it on demand |
| Colour limit blocks an article | Palette error | W3 step 9; never add a sixth colour |
| Seneca items stretched to fit | A "stronger" quote that needs explaining to see the match | Drop it; fewer true items beat many loose ones |
| Clauses that do not read as part of the sentence | The joined sentence stumbles, or the clause says more than its quote | Rewrite it shorter, or drop it and keep the item |
| The page gets bulky again | A new box inside a card, a second strip, a taller vectors column | Rules 14 and 15: one border, one name, folded detail |
| Rights | W5 unresolved while Seneca text is being added to more articles | Finish W5 first; switching later means re-quoting everything |
| Cost creep | `preview` shows more than expected | Stop and report; the letters should always show as cached |

## 7. Reporting

After each task, three lines, no more:

```
Result: <what now exists, in one sentence>
Checks: <build / tests n of n / browser check: pass or the failing line>
Open:   <what the owner must decide or look at, or "nothing">
```

After each article add: the statement, the count of claims and single items, how many of the section's passages are used, which labels are empty, the Seneca counts, and each body clause joined to its sentence.

At the end of a chapter: the list of titles changed in step 1, the articles written, anything that did not fit, and a request for the owner's review.
