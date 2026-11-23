# Milestone M1 — report

23 November 2026 · [the delegation plan](32-delegation-plan.md), section 7 · run by Claude Opus 5.5, checked and completed by Claude Fable 5.2

Decisions D1 to D6 were at their defaults for the run: no commit, no push, embedding cap $0.05, Article 1 untouched, review after the chapter, `AGENTS.md` untracked. The owner asked for a commit after the run; see the end.

## Per task

```
W0 Park and tidy
Result: Production build and tests pass; .serena/ is ignored; nothing was committed during the run (D1).
Checks: npm run build ok · tests 19 of 19 at that point
Open:   nothing

W1.1 Section reader
Result: scripts/aurelius-section.py prints a section in full, and its Seneca candidates with --seneca.
Checks: c6.s6 lists six passages, 10.22 first · c6.s1 --seneca lists Letter 95.52 first
Open:   nothing

W1.2 Browser check
Result: scripts/aurelius-constitution-check.py checks every chapter with articles at 360 dark, 390 and 1440, with and without Seneca, and exits 1 on any failure.
Checks: exit 0 on the page as it was, and exit 0 at the end of the milestone
Open:   it has only ever seen one chapter (see the review)

W1.3 Tests that assumed five articles
Result: Five tests state the general rule instead of "exactly five".
Checks: 14 of 14 on the five existing articles
Open:   the small-section rule admits a statement part with no witness (found by the second review)

W2 Page for 38 articles
Result: The build writes a 16 KB index and one file per chapter with articles; the page loads a chapter when opened, with a chapter picker in the sticky bar.
Checks: tests 20 of 20 · browser check exit 0 · loading line, failure line and retry each exercised · deep links ?at= and #article-N open the right chapter
Open:   faults found by the two reviews (Back button, heading under the bar, phone bar width)

W3 + W4 Article 6
Result: Article 6, "What the whole sends in its season", is on the page with Seneca's items and two body clauses.
Checks: build clean on the first run with every quote · tests 20 of 20 · browser check exit 0
Open:   the owner's review; the two reviews say revise before using it as a model
```

## Article 6

- **Statement:** "What the whole sends me is good for me and comes at the right time, so I want what the world wants."
- **Claims:** 3 fused. **Said once:** 2. **Passages used:** 6 of 6.
- **Empty labels:** If I doubt it (Marcus has no passage for it in this section).
- **Seneca:** backs 3, adds 4, challenges 1.
- **Body clauses, joined to their sentences:**
  - "…so I want what the world wants, the hard things too, which I pay willingly as the tax of being alive." (Seneca adds)
  - "…and when I pray, I pray for everyone, not for myself alone — though I ask outright only for goods like joy and peace, and for the strength to bear pain only if the need comes." (Seneca challenges)
- **Paid call:** 201 tokens to embed six new sentences, about $0.00003.

## Articles 1 to 5 look the same as before

Shots of each article at 390 and 1440 px, Seneca on, were taken before W2 and compared pixel by pixel with shots taken after.

1. **Raw comparison after W2 and Article 6.** They differ. At 1440 px: one band 40 px tall in each article shot. At 390 px: many text lines.
2. **What the band is.** An article is taller than the screen, so the sticky top bar is captured in the middle of each article's shot. The band is that bar: before, "Article 1 2 3 4 5 Topics Sources"; after, the same with the "Chapter 1" button in front and a "6". A crop of the band before and after shows exactly this.
3. **What the 390 px differences are.** The topic tree's row for section c6.s6 changed from plain text with "next" to a link with "Article 6" and became a fraction of a pixel taller; everything below it moved by that fraction, which changes the anti-aliasing of text.
4. **Controlled re-shoot.** With the three additions undone in the browser only (the chapter button removed, the "6" removed, the tree row put back), all ten shots are identical to the before-shots: **0 pixels differ** at 390 and at 1440 px for Articles 1 to 5.

So the articles themselves are unchanged; what changed is the bar and one row of the topic tree, both intended.

## Where the run stopped to ask

Nowhere. No stop condition of W3 was met (the section held together as one topic, its statement differs from the others', the title was already final), no check failed twice, and the private corpus was present.

## After the run

- Two reviews followed: [the handover with both](33-astra-review-handover.md). Verdict on Article 6: revise. [The plan that follows](34-after-review-plan.md) holds Articles 7 to 38 until the checks, the markings and Article 6 are fixed.
- On the owner's word the work since `d576e71` was committed locally, not pushed.
