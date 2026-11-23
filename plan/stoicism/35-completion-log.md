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
- [x] T1 · [x] T2 · [x] T3 · [x] T4 · [x] T5 · [x] T6 · [x] commit N2 · [ ] the owner reads the six and says keep, revise or stop
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

### N2 in progress (23 Nov)

- **T1 edition.** Leopold's text: *M. Antoninus Imperator ad se ipsum*, ed. Jan Hendrik Leopold (11 May 1865 – 21 June 1925, so dead more than 100 years), 1908. Library catalogues and the Classical Review give Oxford, Clarendon Press; the Perseus file's own header says "Leipzig: Teubner, 1908". Both are recorded. Taken from the Perseus Digital Library's `canonical-greekLit` repository, file `tlg0562.tlg001.perseus-grc2.xml` (493,638 bytes, sha256 `7e5017cb…981a2d`), CC BY-SA. The plan says fetching the Greek needs the owner's word: "including the translations" was taken as that word. The Perseus reading site answered a script with a bot check, which was not worked around; the same text was taken from the project's public repository instead.
- **T2 crosswalk, aligned by text:** Casaubon 10.22 → 10.21 · 4.19 → 4.23 · 6.38 → 6.43 · 10.21 → 10.20 · 8.54 → 8.57 · 5.7 → 5.7. All six as the plan believed.
- **T3 draft** by a first translator given the Greek alone (no Casaubon, no article). 45 notes on open readings.
- **T4 check** by a second reader given Greek and English only: 44 points, no passage called wrong. Each point settled in writing (accepted, partly accepted, or declined with a reason) and stored with the passage.
- **Found already:** Casaubon ends 5.7 with "and not every one for himself in particular alone". Leopold's Greek ends at "simply and freely" (ἁπλῶς καὶ ἐλευθέρως). The article's "not for myself alone" rests on Casaubon's addition.
- Working files: scratchpad `greek/` (edition file, `t3/draft.json`, `t4/check.json`).

### N3 groundwork (23 Nov)

- **A3 mechanism.** `inferences: [{words, why}]` on a statement or claim; the build requires the words to stand once, outside backed phrases, with a reason of 20 to 200 characters (fixtures `a3-inference-not-in-the-sentence`, `a3-inference-inside-backed-words`: both rejected); the page names it "The editor's inference" with the reason (case P17: failed on the old page, passes now).
- **Article prompt:** rules 16 to 20 added (context, logged word search, clause tests, inferences, evidence in today's English).
- **A8** started as five separate audits, one per article, each on a private copy, each to hand back its article and a one-page audit (`scratchpad/a8/article<N>/`). Brief: `scratchpad/a8/BRIEF.md`.

### N2 done up to the owner's reading (23 Nov)

- **T4, the two questions that affect Article 6, answered from the Greek:**
  - 5.7: the Greek has no word for community, others or oneself. Marcus says only how to pray: "simply and like a free person". Casaubon's "and not every one for himself in particular alone" has nothing behind it in Leopold's text. → A2: the prayer cannot back "I pray for everyone, not for myself alone".
  - 4.23 (Casaubon 4.19): "All things from you, all things in you, all things into you": three phrases without a verb, addressed to nature. Nothing about working or tending toward one end; that is 6.43. → A1: 4.19 must not back "work toward one end".
- **T5 store:** `content/aurelius/translation/project-v1.json` (edition, method, limits; per passage: Casaubon reference and revision, standard reference, Greek, English, 43 notes on open readings, 46 settled points, its own revision id). `scripts/aurelius-translation.py` checks it and writes `public/apps/stoic-translation.json`. A passage reworded without a new revision is rejected. Tests: `tests/aurelius/translation.test.mjs` (5). Fault fixtures: `t5-english-edited-in-place`, `t5-old-english`, `t5-note-misquotes-the-greek` (all rejected).
- **T6 page:** `public/apps/stoic-translation.html`: Greek, today's English and 1634 side by side on a wide screen; one at a time on a phone with a switch (or all three stacked); both lists of notes under each passage; Keep / Revise per passage and "Copy my verdicts". Linked from the top of the constitution page. Browser case `T6`. This case was written after the page, so it was not seen to fail first.
- **Final English of the six** (what the owner is asked to read):
  - 10.21: "The earth loves the rain, and the holy sky loves," and the universe loves to bring about whatever is to come. So I say to the universe: "I love along with you." And is that, too, perhaps said in this sense: "this loves to happen"?
  - 4.23: Universe, everything that fits well with you fits well with me. Nothing that is timely for you is too early or too late for me. Nature, everything your seasons bear is fruit to me. All things from you, all things in you, all things into you. One man says, "Dear city of Cecrops." But you, will you not say, "Dear city of Zeus"?
  - 6.43: Surely the sun does not think it should do the rain's part? Or Asclepius the part of the fruit-bearing goddess? And what of each of the stars? Are they not different, yet working together toward the same thing?
  - 10.20: What the nature of the whole brings to each is good for each, and it is good at the time when nature brings it.
  - 8.57: see the page (the sunbeam).
  - 5.7: A prayer of the Athenians: "Rain, rain, dear Zeus, down on the ploughland of the Athenians and the plains." Either one should not pray, or one should pray like this: simply and like a free person.
- **Checks:** build exit 0 · constitution, composition and translation tests pass · fixtures all rejected · browser check exit 0 (sweep, P1–P17, T6).
- **Not mine, noted:** two older tests fail before and after this work and are outside plan 34: `tests/aurelius/book.test.mjs` ("reading plan: the first chapter states recurring lessons…") and "the shipped previous study upgrades additively…".

