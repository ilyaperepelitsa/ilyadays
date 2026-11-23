# Milestone N1 "Trust the markings": report

23 November 2026 · [the plan](34-after-review-plan.md), rows G1 to G8 and P1 to P12 · run by Claude Opus 5.5

The decisions were set by the goal: Q3 = yes (P11 done), one local commit at the end, no push, no paid calls. No article's wording, claims or quotes changed. The only edits to the authored record are the G2 migration and the "TO REVIEW IN N3" placeholders for G7 and G8.

## Summary

```
Result: Every G and P row has a case that was seen to fail before its fix and passes now.
Checks: build exit 0 · node tests 22 of 22 (0 failures) · fixtures: all 13 faults rejected · browser check exit 0 (sweep + P1–P12, two-chapter simulation included) · npm run build exit 0
Open:   60 context sentences and 6 search logs are placeholders for N3; Articles 1, 4 and 5 are on G1's exempt list
```

## One line per row: the case, the failure seen, the fix

Build and tests. The fault fixtures are in `scripts/aurelius-constitution-fixtures.py`, run with `apps/aurelius/.venv/bin/python scripts/aurelius-constitution-fixtures.py`. Each case mutates a copy of the record and runs the real build or the real test file on it. Before the fixes, 12 of 13 faults were accepted.

```
G1  g1-article-5-without-exemption (STOIC_KNOWN_BELOW=1,4) · accepted: the pooled 35% test passed with Article 5 at 0/9 · per-article test (a third, or ≥1 below 8 passages), exempt list [1,4,5], a listed article that meets the bar fails as stale; the build prints "shared components a/b"
G2  g2-clause-cites-another-item, g2-clause-without-from · both built clean · clauses carry `from`; every id must belong to a `from` item; statement and claim clauses must come from items about that target; a challenge needs a qualified item on its claim; ten clauses migrated. Message: "clause on c2 (challenges) “…” cites S71.13c, which belongs to item S71.13c (stronger, claim c3), not to the items it comes from: q1 (qualified, claim c2)"
G3  g3-duplicate-item-key · built clean · keys of wider and qualified items are unique per voice and article; the error names both items
G4  synthetic test "in a small section every statement part still needs a witness" (A6 copied, section_size 4, part 0 emptied) · test failed 15/16 · the test and the build require ≥1 id per part; "some part rests on two passages" was already tested. Fixture g4-statement-part-without-witness is rejected by the build too
G5  g5-chapter-file-repeats-an-article, g5-chapter-file-lacks-an-article · the repeat passed; the missing article was already caught by an existing test · each chapter file's ordered numbers must equal the stubs' numbers, with no repeats
G6  g6-statement-passages-share-a-colour (10.21 painted as 10.22) · passed · the build keeps passages in one claim or part apart (hard) and passages anywhere in the statement apart when five colours allow (soft), otherwise shares the farthest pair and prints a note; the test checks the statement's distinct refs have distinct colours
G7  g7-piece-without-context, g7-context-too-short, g7-published-piece-without-context · all accepted · `context` required (placeholder, or 20–200 characters); published as null for the placeholder; the page shows "In context: …" under the passage
G8  g8-voice-without-search-log, g8-two-searches · both accepted · `searched` required (placeholder, or ≥3 searches and rejected entries with ref and why); kept in the authored record only (0 occurrences in public/)
```

The page cases are in `scripts/aurelius-constitution-check.py`, run with `--cases P1,…`. Before the fixes, all 12 failed.

```
P1  Article 3, pick "fit myself to it", switch Seneca on · the pick moved to "more than accept it"; source list and picked words disagreed · the pick is re-found from its words after every redraw (cleared if they appear 0 or 2+ times)
P2  Article 6, ?without=6:4.19, then 4.19,6.38,10.22 with Seneca · "Fused from 3 passages"; "No passage left" beside a live Seneca chip; words Seneca backs struck; removed chips unmarked · "2 of 3 passages remain for this claim" / "Marcus's passages for this claim are removed; what remains is Seneca's"; strike only when every source is gone; removed chips marked (also to screen readers)
P3  storage refused, press Keep · the verdict sprang back, nothing said, missing from the copied list · kept for the session, "Could not be saved on this device; kept until you close this page", included in the copy
P4  switch chapter, press Back · Back left the constitution · deliberate switches push a history entry; popstate restores chapter, voices and selection
P5  type #article-2 while chapter 2 is open · Articles 4–6 stayed · hashchange goes through goToArticle
P6  switch chapter, measure the heading · heading at 29 px under a bar ending at 56 px · scroll-margin-top on #articles
P7  ?without=1:… then open chapter 2 · the removal was dropped from the link · unread removals kept in state.pending and applied when their chapter loads
P8  chapter file missing Article 6 / server failing then recovering / drawing error · drew 1–5 silently; Try again reused bad data; a drawing error reported as a load error with Try again · validate before caching, fetch with no-cache, per-card try/catch: "Article N could not be drawn (…). The rest of the chapter is shown."
P9  open chapter 2, look at the topic tree · tree had chapter 1 open · the tree opens the chapter on screen
P10 360 px bar · 4, 5, 6, Topics, Sources off screen; no article button · compact bar "Ch. 1 / Art. 6" with a popover list of the chapter's articles; fitBar adds .compact when it overflows
P11 Article 6, pick "all of them work toward one end" in light, dark and forced colours; pick "; yet" · no "Sources for the selected words"; nothing on the editor's words · 1 px lines with clearance; a list with one row per source (colour dot, line sample, author and reference) then "Show the quotes"; "The editor's connection: … joins “A” to “B”. No passage says these words."
P12 two-chapter simulation (index with Articles 4–6 as c3, served by route) · Back after the neighbour link showed no articles · fixed by P4/P5/P9; the simulation now covers the picker, neighbour link, Back and deep links
```

### P11's reader task, and what it changed

A cold reader (a subagent with no part in the work, given only screenshots) did the review's task in light 1440, dark 390, and forced colours 390. The task: select the last phrase of Article 6's first claim, name its witnesses, open the quotes, and say what changes when 4.19 is removed.

- **Wrong answers: none.** In every setup it named 6.38, 4.19 and Seneca's Letter 71.13, found all three quotes, and read "2 of 3 passages remain" with 4.19 marked removed.
- **Problems it raised, which became four extra failing-then-passing checks in P2 and P11.** Reverted page: `reader-fixes-before.txt`, 2 cases failed. Fixed page: both pass.
  - At 1440 the 6.38 and 4.19 samples were both thin dark lines, so a 1 px line could not carry colour. Each source row now leads with the passage's colour dot, as in the chips, and the pattern sample is drawn at 2 px. Check: Marcus's sources in the list show distinct colours.
  - In forced colours the picked words had no mark. Fix: a 2 px `Highlight` outline. Check: the outline exists in forced colours.
  - "2 of 3 passages remain" could be read as being about the picked words. It now reads "… for this claim".
  - The column header "The passage, in Marcus's words" stood over Seneca's quotes. With an added author on, it now reads "The passage, in its author's words".
- **Raised but not page faults.**
  - The placeholder context line is shown to readers. This is expected until N3.
  - The two 6.38 quote cards are content, so they belong to N3.
  - Hover dimming, and forced colours missing from two removed-state captures, came from how the screenshots were taken.

## Screenshots looked at

- **Articles 1 to 6, Seneca on, the first claim's quotes open, at 390 and 1440 px.** Taken after every fix. Contact sheets: `look2/sheet-390.png` and `look2/sheet-1440.png`. Every article draws, with no page errors. The column header reads "in its author's words" with Seneca on and "in Marcus's words" without. The bar reads "Ch. 1 / Art. N" at 390. A bar or Voices pill in the middle of a shot is the sticky element captured by an element screenshot. Viewport shots show the vectors column sticks at 66 px.
- **G6 colour changes.** Article 6's statement now shows 10.21 and 10.22 in different colours. Article 3 prints the one allowed note: "6.35 shares a colour with 10.5 in the statement; five colours cannot keep all apart".
- **The source list after the fix.** `picked-after-1440-light.png` and `picked-after-390-dark.png`: brown 6.38, blue 4.19, and Seneca's square with a dotted line.

All of these are in the session scratchpad (`…/scratchpad/n1/`) and are not committed.

## Where this run departs from the plan

- **G1.** The exempt list is [1, 4, 5], not [1, 4, 5, 6]. Article 6 meets its bar (3 of 11, and its section has fewer than 8 passages), and a listed article that passes fails as stale.
- **G2.** A statement clause may also come from a qualified item on a claim that feeds the statement. Article 5's statement clause is built this way. The rule still ties every id to an item about the same target.
- **G4.** The review's four-passage fixture conflicts with the topic cross-check, so the control run failed too. It is a synthetic in-file test instead; the build fixture uses the real section.
- **G5.** The "lacks an article" case was already caught before the fix, by an existing test on the index. Only "repeats" was new.
- **G6.** The fixture paints 10.21 as 10.22. Those two never meet in one claim or one part, so only the new statement rule can catch it.
- **P10.** Compact labels on the phone are "Ch. 1" and "Art. 6", with "Article 6 of 6" as the accessible name.
- **P11's risk row: "the mockup first, then one article".** No separate mockup was made, because Q3 was answered yes in the goal. The new look was checked on Article 6 first (the case and the reader task), then on all six.
- **Chapter files.** These are now written compact, with no indent, at 216 KB for c6. The build warns above 600 KB.

## Placeholders awaiting N3

The build prints: "context on 60 of 60 added-author pieces, search log on 6 of 6 voices". The page shows "In context: not yet read and written down (to be done in review)".

## Where the run stopped to ask

Nowhere. None of the fixes changed what an article says. No check failed twice after a real attempt. The two first attempts that did fail were faults in the checks themselves, not in the page: the build fixture lacked an output folder, and P11's locator did not match the joining span "; yet". No two rows conflicted. Every row reproduced as described, apart from the G5 missing-article case noted above.
