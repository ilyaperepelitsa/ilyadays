# Goal: the methodology page as a scientific paper with share-ready figures

Owner, 24 Nov 2026: “documentation should have descriptive diagrams that are cool looking. very important. I wanna share
them as well later on linkedin”, “treat documentation as a scientific paper”, “give me good goal definition for driving
methodology/documentation page to such standard. with visuals tests, frontend etc”.

## Goal (paste after /goal)

Bring the Stoic Constitution methodology page (public/apps/stoic-method.html, English and Russian) to the standard of a
published scientific paper with share-ready figures, live on ilyadays.com, and prove it with tests. Done only when every
criterion in plan/stoicism/38-method-paper-goal.md holds, each is checked by an automated test or a recorded review, all
suites are green, and the live page has been verified at 390 and 1440 px.

## Acceptance criteria

### Paper
1. Structure, same order in both languages: title, authors and tools, version and date, abstract (≤ 200 words),
   1 Introduction with a contributions list, 2 Materials, 3 Methods (embedding, clustering, naming, fusion and the article
   schema, the five sides, a second author, translation, prompting and feedback as rules), 4 Validation, 5 Results,
   6 Limitations and open questions, 7 Conclusion, References, Appendices (prompt rules, file map, EN/RU glossary).
2. Every number is tagged and equals the value computed from the published JSON; a changed number fails a test.
3. Every claim about how the work was done links to the file that does it or to a reference; references are real and
   checkable, each cited in the text, none uncited.
4. Figures and tables are numbered, captioned in paper style, and each is referred to in the text at least once.
5. Limitations are candid and the open questions match plan/stoicism/37-owner-points.md.
6. The Russian is a full translation using the fixed glossary; a test finds no untranslated English sentences.

### Figures
7. At least eight figures drawn from the real data: pipeline, embedding map, dendrogram, fusion of one article, the five
   sides, Seneca as a second voice, translation, checks. Each stands alone when shared: title, subtitle, legend where
   needed, and the credit “ilyadays.com · Stoic Constitution”. Each exists in EN and RU, light and dark.
8. Quality gates, tested: the palette passes the dataviz validator (colour-blind separation); no label overlaps
   (bounding-box collision test); text ≥ 12 px at 390 and 1440; <title> and <desc> on every SVG; text kept as text.
9. Share files for every figure, EN and RU: a 1200×1200 and a 1200×627 PNG, made by one reproducible script, linked under
   the figure and collected in a gallery; a test that every file exists, has the right size and is referenced.

### Front end
10. The shared site header stays pinned with its EN/RU switch; paper typography; the contents list follows the reader;
    anchors land below the pinned header.
11. 390 and 1440 px count equally: no horizontal page scroll; figures readable at both (a vertical layout or a scrolling
    frame on narrow screens); light and dark.
12. Print and PDF: a print stylesheet that gives a clean paper; an A4 PDF made with Playwright shows every figure whole.
13. Accessibility: no axe-core violations; headings in order; every figure has a text description.

### Process
14. Visual regression: screenshots of every section and figure at 390 and 1440, light and dark, EN and RU, compared with
    approved baselines; baselines change only on purpose.
15. Peer review: a reviewer who did not write the paper reads it as a referee (claims against evidence, clarity, figure
    quality); every point is settled in writing (accepted, partly accepted, declined).
16. npm test, the Constitution browser check and the method-page checks pass; committed, pushed, deployed, and verified on
    https://www.ilyadays.com/apps/stoic-method.html with screenshots at both widths.
