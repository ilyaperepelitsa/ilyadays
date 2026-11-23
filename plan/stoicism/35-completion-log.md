# Plan 34 to completion: running log

Started 23 November 2026 by Claude Fable 5.2 on the owner's word: "drive it to completion please. including the translations". This file is the working log and becomes the report. [The plan](34-after-review-plan.md) · [N1 report](34-N1-report.md).

Standing rules: never push; one local commit at the end of each milestone (plan Q1); nothing under `.aurelius/` enters a tracked file; changes to Marcus's wording in Article 1 are proposed, not made (Q4); N2's scope is six passages (c6.s6) and nothing wider.

## Order of work

1. **R: review fixes to N1** (from the second look at commit `796b763`)
   - R1 A tap on "Topics" redraws the chapter and drops the picked words (Back/Forward handler fires on in-page links).
   - R2 A chapter file newer than the index: "Try again" can never succeed.
   - R3 The statement says "Gathered from 3 passages" with all three removed.
   - R4 On a phone at the top of the page the article list opens below the fold, under the Voices dock.
   - R5 G7/G8 accept the placeholder for any article, for ever: allow it only for a named list.
   - R6 Page cases are tied to Article 6's wording, which N3 rewrites: run them on a frozen fixture record.
   - R7 Chapter files back to readable JSON (compact saved 6 KB gzipped, made diffs unreadable); source list in the order of the lines.
2. **N2: translation pilot** T1 to T6.
3. **N3: Article 6 revised, Articles 1 to 5 audited** A1 to A8, then the standing documents.

## Status

- [x] R1 · [x] R2 · [x] R3 · [x] R4 · [ ] R5 (settled at the end of N3: the placeholder stops being accepted) · [x] R6 · [x] R7 · [x] commit R
- [ ] T1 · [ ] T2 · [ ] T3 · [ ] T4 · [ ] T5 · [ ] T6 · [ ] commit N2
- [ ] A1 · [ ] A2 · [ ] A3 · [ ] A4 · [ ] A5 · [ ] A6 · [ ] A7 · [ ] A8 · [ ] documents · [ ] commit N3

## Log

### R: review fixes to N1 (23 Nov)

Each has a case in `scripts/aurelius-constitution-check.py` that failed first (`--cases P13,P14,P15,P16`: 4 of 4 failed) and passes now.

```
R1  P13 · "a tap on Topics redrew the chapter; dropped the picked words" · the Back/Forward handler ignores entries that differ only in their #part
R2  P14 · "Try again" fetched the same file for ever · a file out of step with the index says "This page is out of date… Reload to see it" and the button reloads
R3  P15 · "Gathered from 3 passages" with all three removed · the statement counts what is left, as a claim does ("2 of 3 passages remain for this statement")
R4  P16 · the article list and chapter list opened below the fold under the Voices dock · the bar is brought to the top of the screen before a list opens
R6  the page cases run on tests/aurelius/fixtures/constitution-page-cases.json (a frozen copy of the record, built by the real build, served by route) · so N3 can rewrite Article 6 without breaking P1, P2, P11, P12
R7  chapter files are indented again (compact saved 6 KB after gzip and made the diff one 220 KB line) · the first source is now the top line, so lines read downward in the order of the list
R5  not done as an allow-list: N3 fills every context and search log, after which the build rejects the placeholder outright
```

Checks after R: build exit 0 · tests 22 of 22 · fixtures all rejected · browser check exit 0 (sweep + P1–P16).

