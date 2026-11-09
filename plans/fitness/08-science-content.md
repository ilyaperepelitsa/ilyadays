# 08 — Science pages: renderer, topic engine, safety content

Status: done · 2026-11-09 · Stream 08a (engine + safety content + the `safety` and `progression` topics).
Streams 08b and 08c only add topic files under `content/fitness/science/` in the format below. Contract:
`00-master-plan.md` §2 (rules 7 and 10), §3 (routes), §4 (ownership); the master plan wins.

## Scope

- Our own tiny markdown renderer (no dependency): front matter + the subset of markdown the explainers use.
- Topic loading from `content/fitness/science/<slug>.<lang>.md`, whatever topics exist (08b/08c write in parallel).
- `/fitness/science` (a card per topic) and `/fitness/science/[topic]` in EN and RU, static (SSG).
- `content/fitness/safety.json`: warm-up, pain traffic light, red flags, recovery, cue library per exercise class.
- Topics `safety` (injury prevention, warm-up, technique, pain) and `progression` (exactly what
  `src/lib/fitness/progression.mjs` + `session.mjs` do), EN + RU.

## Files (owned)

| File | What |
| --- | --- |
| `src/lib/fitness/markdown.mjs` | `renderMarkdown(text, { lang })` → `{ meta, html, toc }`; `parseFrontMatter`, `renderBody`, `parseSource`, `slugify`, `escapeHtml`, `safeHref`, `citationsIn`, `wordCount`, `plainText` |
| `src/lib/fitness/science-core.mjs` | fs side (Node only): `SLUG_RE`, `scienceDir`, `topicFiles(dir)`, `listTopicsIn(dir, lang)`, `readTopicIn(dir, lang, slug)` |
| `src/lib/fitness/science.ts` | typed server-only wrapper: `listTopics(lang)`, `getTopic(lang, slug)`, `topicSlugs(lang)` |
| `src/components/fitness/science/Article.tsx` | server: header (title, lede, updated, reading time, source count), nav slot, TOC (phone `<details>`, desktop sticky list), body `.fit-article`, sources `<ol>` with `id="src-n"` |
| `src/views/fitness/ScienceIndexView.tsx`, `ScienceView.tsx` | views; `scienceParams(lang)`, `scienceMetadata(lang, topic)` |
| `src/app/(en)/fitness/science/page.tsx`, `[topic]/page.tsx`, same under `src/app/ru/` | thin routes |
| `src/styles/fitness/science.css` | ≈68ch measure, tables scroll in their own box, callout, small citation superscripts |
| `content/fitness/safety.json` | safety data (shape kept; consumers: `tracker.safetyInfo()` → StartPanel) |
| `content/fitness/science/{safety,progression}.{en,ru}.md` | the two explainers |
| `tests/fitness/markdown.test.mjs`, `tests/fitness/science.test.mjs` | renderer; content checks for every topic present, the loader, `safety.json`, the progression page replayed through the engine |

## Topic file format (shared with 08b / 08c)

```
---
title: One line
description: One sentence for cards and link previews.
updated: 2026-11-08
order: 3
sources:
- [1] Title — Outlet, year. https://doi.org/…
---
Body: ## / ### headings, short paragraphs, lists (one nested level), at least one pipe table, `> **In short:** …`
callouts, inline citations [n] (adjacent [2][5] or [2, 5]), a "## What this means for me" section and a "## Caveats"
section (RU: "## Что это значит для меня", "## Оговорки"). No `#` heading in the body (the title is the page h1).
Links: http(s) or site-relative (`/fitness/...`; RU files may write `/ru/fitness/...`, plain `/fitness/...` is
localised automatically).
```

Order: goals 1, progression 2, safety 3, longevity 4, nutrition 5, analytics 6. Body 900–2000 words (tokens with a
letter or digit, citations and link targets excluded).

## Contract / API

- `renderMarkdown(text, { lang })` → `{ meta: { title, description, updated, order, sources: Source[] }, html, toc,
  errors }`; `Source = { n, text, title, outlet, year, url }`; `toc = [{ id, text, level: 2 | 3 }]`.
- Inline: `**bold**`, `*italic*`/`_italic_`, `` `code` ``, `[text](href)` (http(s) or relative; anything else renders
  as text), `[n]` / `[n][m]` / `[n, m]` → `<sup class="fit-cite"><a href="#src-n">n</a>,…</sup>`.
  Blocks: `#`–`######` (slug ids, unique, never `src-n`), paragraphs, `-`/`*`/`+` and `1.` lists with one nested level,
  pipe tables (header + alignment row; wrapped in a focusable scroll box), `>` callouts (`div.fit-callout`), `---`
  rules, fenced code. Everything else is text: `<`, `>`, `&`, quotes are escaped.
- `getTopic(lang, slug)` → `{ slug, title, description, updated, order, minutes, html, toc, sources } | null`;
  `listTopics(lang)` sorted by `order`, then slug. Slugs must match `^[a-z0-9]+(-[a-z0-9]+)*$` (same rule as the
  offline catalog); other files are ignored.

## Design decisions

1. **Renderer is a small hand-written parser**, not regex soup: emphasis closers are searched with flanking rules,
   code spans are opaque, links only for safe schemes, so authors cannot inject HTML and `snake_case` stays text.
2. **Front matter is line-based YAML-lite** (key: value + the `sources:` list) — enough for the format, no YAML lib.
3. **Citations merge** (`[2][5]` → one superscript "2, 5") so adjacent numbers never read as "25".
4. **TOC twice, CSS picks one**: a closed `<details>` on phones, a sticky sidebar list from 1040 px. A single
   `<details>` cannot be "open on desktop" without JS; the hidden copy is `display: none` (out of the a11y tree).
5. **Dates in UTC** (`timeZone: "UTC"`) so a build machine west of Greenwich does not print 7 November.
6. **science-core.mjs + science.ts** mirrors `store-core.mjs` / `store.ts`: the fs logic is testable in node:test,
   the TS wrapper only adds types and the content path.
7. **safety.json keeps the placeholder shape** (`warmup.general`, `warmup.ramp`, `pain[].level/range/action`,
   `redFlags: Text2[]`, `recovery: Text2[]`, `families`, `sources`) because `tracker.safetyInfo()` reads it; new keys
   are additions (`warmup.minutes`, `warmup.activation`, `warmup.rules`, `globalCues`, `doms`, per-entry `source`).
   Source ids are the numbers of the safety explainer, so `[n]` means the same thing in both. The ramp equals
   `templates.json` `warmupRamp` (tested).
8. **Progression page describes the engine, not the research**: every number (made = reps ≥ target and RIR ≥ target − 1,
   step = max(increment, 2.5 %), widen ≤ 2 reps when a step exceeds (30 + top + RIR)/(30 + bottom + RIR) − 1,
   2 misses → −10 % (strength 3), gaps 14/28 days, deload every block of 5 weeks, ×0.6 sets, +2 RIR) is read from
   `templates.json` / `progression.mjs`, and the worked example is the engine's own output (tested).

## Acceptance checks

- `node --test tests/fitness/markdown.test.mjs tests/fitness/science.test.mjs` pass.
- `npx tsc --noEmit` (whole repo) exit 0; `npx eslint` on the stream's files clean.
- Every topic present: `.en.md` and `.ru.md`, complete front matter, same `order` and source count in both
  languages, sources numbered 1…n, every cited `[n]` exists, body 900–2000 words, has a table, "What this means for
  me" and "Caveats" sections, no `#` in the body.
- `safety.json`: ramp equals `templates.json` warmupRamp; pain levels green/amber/red cover 0–10; every family key
  is a registry class; every `source` id exists in the safety explainer with the same URL.

## Status

Done · 2026-11-09 (resumed after the usage-limit stop).

- From the first run, complete and unchanged: renderer, loader, `science.ts`, `Article`, both views, the four
  routes, `science.css`, `safety.json` (36 families = every registry class, 50 sources) and the `safety` explainer.
- Added `progression.ru.md` (source lines copied verbatim from the EN file) and `tests/fitness/science.test.mjs`
  (84 tests): every topic present has complete front matter, https sources with years, every source cited and every
  citation sourced, 900–2000 words, a table, the two closing sections, safe links that lead to existing pages and
  anchors that resolve, and an RU file that mirrors the EN one (order, source lines, cited numbers, heading / table /
  callout counts); the loader on a temp folder; `safety.json` against templates, registry and the explainer; the
  progression worked example replayed through `nextState` with slot A1's `slotParams` in both languages (targets,
  outcomes, e1RM 50 → 57), the engine parameters the page quotes, the owner's rep ranges, deload weeks 6 / 12 / 18.
- Precision fixes to `progression.en.md` after re-reading the engine: lighter sets block progression and count as a
  miss only below the range; conversions carry the working weight's implied maximum (not the stored e1RM); endurance
  mode steps 5 % with a 3-rep overshoot; deload set counts are rounded and test sessions are not deloaded; a weight
  step takes five to eight weeks on 6–10 (the example's eight), not four to six.
- Checks: `node --test tests/fitness/markdown.test.mjs tests/fitness/science.test.mjs` 113 pass; the whole `npm test`
  glob 720 pass; `npx tsc --noEmit` exit 0; `npx eslint` on the stream's files clean. Not run here (orchestrator
  rule): `next build` and a browser pass of `/fitness/science/*` at 360 px — stream 12 QA.

## Open questions

- Research 03 proposes a 4-tier ramp (70 % × 4 from the moderate tier, 92 % × 1 for the max tier, an isolation
  feeler set before the first exercise for a joint). The engine (stream 03) keeps 50/70/85 with the 80 % / 8-rep
  heavy cut-off and ramps compounds only; safety.json and the explainer follow the engine. Changing it is an engine
  change (`templates.json` `warmupRamp` + `warmupRamp()` filter).
- Readiness (sleep/energy/soreness) is logged but does not change the plan; research 03 §M rules (short night → no
  top sets, +1 RIR; 3 bad nights → deload) are written as advice, not automation.
