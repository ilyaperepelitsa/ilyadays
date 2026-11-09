// Stream 08: the science explainers (content/fitness/science/<slug>.<lang>.md), the topic loader
// (src/lib/fitness/science-core.mjs), content/fitness/safety.json, and the progression explainer against the engine it
// describes. Works with whatever topics exist: every topic file present is checked.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { renderMarkdown, wordCount } from "../../src/lib/fitness/markdown.mjs";
import {
  SLUG_RE, listTopicsIn, readTopicIn, readingMinutes, scienceDir, topicFiles,
} from "../../src/lib/fitness/science-core.mjs";
import { exerciseById } from "../../src/lib/fitness/catalog.mjs";
import { deloadWeek, initialState, maxStepFraction, nextState } from "../../src/lib/fitness/progression.mjs";
import { buildProgram, slotParams } from "../../src/lib/fitness/templates.mjs";
import registry from "../../content/fitness/registry.json" with { type: "json" };
import templates from "../../content/fitness/templates.json" with { type: "json" };
import safety from "../../content/fitness/safety.json" with { type: "json" };

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DIR = scienceDir(ROOT);
/** @type {("en" | "ru")[]} */
const LANGS = ["en", "ru"];
const WORDS = { min: 900, max: 2000 };
const SECTIONS = {
  en: { me: "What this means for me", caveats: "Caveats" },
  ru: { me: "Что это значит для меня", caveats: "Оговорки" },
};

/* ------------------------------------------------------------------ every topic file, rendered once */

const FILES = topicFiles(DIR);
/** @type {Map<string, Record<string, ReturnType<typeof renderMarkdown>>>} */
const TOPICS = new Map();
for (const [slug, langs] of FILES) {
  /** @type {Record<string, ReturnType<typeof renderMarkdown>>} */
  const byLang = {};
  for (const lang of langs) byLang[lang] = renderMarkdown(fs.readFileSync(path.join(DIR, `${slug}.${lang}.md`), "utf8"), { lang });
  TOPICS.set(slug, byLang);
}

/** @param {string} html */
const citedIn = (html) => [...new Set([...html.matchAll(/href="#src-(\d+)"/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
/** @param {string} html @param {RegExp} re */
const count = (html, re) => (html.match(re) ?? []).length;
/** @param {ReturnType<typeof renderMarkdown>} t @param {2 | 3} level */
const headings = (t, level) => t.toc.filter((x) => x.level === level).map((x) => x.text);

/** Fitness routes from the App Router tree: "/fitness/tools", "/fitness/exercises/[id]" … */
function fitnessRoutes() {
  const base = path.join(ROOT, "src", "app", "(en)");
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name === "page.tsx") out.push(`/${path.relative(base, dir).split(path.sep).join("/")}`);
    }
  };
  walk(path.join(base, "fitness"));
  return out;
}
const ROUTES = fitnessRoutes();

/**
 * Does a site path (without the /ru prefix, query or hash) lead to a page that exists for this language?
 * @param {string} p @param {"en" | "ru"} lang
 */
function pageExists(p, lang) {
  if (ROUTES.includes(p)) return true;
  const ex = /^\/fitness\/exercises\/([^/]+)$/.exec(p);
  if (ex) return ROUTES.includes("/fitness/exercises/[id]") && Boolean(exerciseById(ex[1]));
  const topic = /^\/fitness\/science\/([^/]+)$/.exec(p);
  if (topic) return ROUTES.includes("/fitness/science/[topic]") && Boolean(FILES.get(topic[1])?.has(lang));
  return false;
}

/* ------------------------------------------------------------------ topic files */

describe("science topics", () => {
  it("include this stream's topics, and every slug is a valid page slug", () => {
    assert.ok(FILES.has("safety"), "safety topic missing");
    assert.ok(FILES.has("progression"), "progression topic missing");
    for (const slug of FILES.keys()) assert.match(slug, SLUG_RE);
  });

  it("exist in English and Russian", () => {
    for (const [slug, langs] of FILES) assert.deepEqual([...langs].sort(), ["en", "ru"], `${slug}: both languages needed`);
  });

  for (const [slug, byLang] of TOPICS) {
    for (const lang of LANGS) {
      const t = byLang[lang];
      if (!t) continue;
      const name = `${slug}.${lang}.md`;

      it(`${name}: complete front matter, sources numbered 1…n with URLs, every citation has a source`, () => {
        assert.deepEqual(t.errors, [], `${name}: ${t.errors.join("; ")}`);
        assert.ok(t.meta.title.length >= 8, `${name}: title`);
        assert.ok(t.meta.description.length >= 40, `${name}: description`);
        assert.ok(Number.isInteger(t.meta.order) && t.meta.order > 0, `${name}: order`);
        assert.ok(t.meta.sources.length >= 3, `${name}: sources`);
        t.meta.sources.forEach((s, k) => {
          assert.equal(s.n, k + 1);
          assert.match(String(s.url), /^https:\/\/\S+$/, `${name}: source [${s.n}] needs an https URL`);
          assert.match(s.year, /^\d{4}[a-z]?$/, `${name}: source [${s.n}] needs a year`);
          assert.ok(s.title && s.outlet, `${name}: source [${s.n}] needs "Title — Outlet, year."`);
        });
      });

      it(`${name}: every source is cited in the text`, () => {
        assert.deepEqual(citedIn(t.html), t.meta.sources.map((s) => s.n));
      });

      it(`${name}: body of ${WORDS.min}–${WORDS.max} words`, () => {
        const words = wordCount(t.body);
        assert.ok(words >= WORDS.min && words <= WORDS.max, `${name}: ${words} words`);
      });

      it(`${name}: no # title in the body, a table, "${SECTIONS[lang].me}" and "${SECTIONS[lang].caveats}"`, () => {
        assert.equal(count(t.html, /<h1[ >]/g), 0, `${name}: the page title is the h1`);
        assert.ok(count(t.html, /<table>/g) >= 1, `${name}: needs a table`);
        const h2 = headings(t, 2);
        const me = h2.indexOf(SECTIONS[lang].me);
        const caveats = h2.indexOf(SECTIONS[lang].caveats);
        assert.ok(me >= 0, `${name}: "## ${SECTIONS[lang].me}" missing`);
        assert.ok(caveats > me, `${name}: "## ${SECTIONS[lang].caveats}" missing or before "${SECTIONS[lang].me}"`);
      });

      it(`${name}: links are safe and lead to pages that exist; anchors resolve`, () => {
        const ids = new Set([...t.html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
        ids.add("sources"); // the Article component's sources heading
        for (const s of t.meta.sources) ids.add(`src-${s.n}`);
        for (const [, href] of t.html.matchAll(/<a href="([^"]*)"/g)) {
          if (href.startsWith("#")) {
            assert.ok(ids.has(href.slice(1)), `${name}: anchor ${href} has no target`);
            continue;
          }
          if (/^https?:\/\//.test(href)) continue;
          assert.ok(href.startsWith("/"), `${name}: link ${href} must be http(s) or site-relative`);
          const ru = /^\/ru(?=[/?#]|$)/.test(href);
          assert.equal(ru, lang === "ru", `${name}: ${href} points at the other language`);
          const page = (ru ? href.slice(3) : href).split(/[?#]/)[0] || "/";
          if (page.startsWith("/fitness")) assert.ok(pageExists(page, lang), `${name}: ${href} is not a page`);
        }
      });
    }

    const { en, ru } = byLang;
    if (en && ru) {
      it(`${slug}: the Russian file mirrors the English one (order, sources, citations, structure)`, () => {
        assert.equal(ru.meta.order, en.meta.order);
        assert.equal(ru.meta.updated, en.meta.updated);
        assert.deepEqual(ru.meta.sources.map((s) => [s.n, s.text, s.url]), en.meta.sources.map((s) => [s.n, s.text, s.url]));
        assert.deepEqual(citedIn(ru.html), citedIn(en.html));
        assert.equal(headings(ru, 2).length, headings(en, 2).length, "## sections");
        assert.equal(headings(ru, 3).length, headings(en, 3).length, "### sections");
        assert.equal(count(ru.html, /<table>/g), count(en.html, /<table>/g), "tables");
        assert.equal(count(ru.html, /fit-callout/g), count(en.html, /fit-callout/g), "callouts");
      });
    }
  }

  it("have distinct orders, so the index has a stable sequence", () => {
    const orders = [...TOPICS.values()].map((t) => (t.en ?? t.ru).meta.order);
    assert.equal(new Set(orders).size, orders.length);
  });
});

/* ------------------------------------------------------------------ the loader */

describe("science-core", () => {
  /** @type {string[]} */
  const temps = [];
  after(() => {
    for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
  });
  /** @param {Record<string, string>} files */
  function tempDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fitness-science-"));
    temps.push(dir);
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    return dir;
  }
  /** @param {string} title @param {number} order */
  const topic = (title, order) => [
    "---", `title: ${title}`, "description: A test topic.", "updated: 2026-11-08", `order: ${order}`, "sources:",
    "- [1] A study — A Journal, 2020. https://doi.org/10.1000/x", "---", "", "## One", "", "Text [1].", "",
  ].join("\n");

  it("lists the real topics of each language by order, with summaries that match the pages", () => {
    for (const lang of LANGS) {
      const list = listTopicsIn(DIR, lang);
      assert.deepEqual(list.map((t) => t.slug).sort(), [...FILES].filter(([, l]) => l.has(lang)).map(([s]) => s).sort());
      for (let k = 1; k < list.length; k++) {
        const [a, b] = [list[k - 1], list[k]];
        assert.ok(a.order < b.order || (a.order === b.order && a.slug < b.slug), `${lang}: ${a.slug} before ${b.slug}`);
      }
      for (const s of list) {
        const t = TOPICS.get(s.slug)?.[lang];
        assert.ok(t);
        assert.equal(s.title, t.meta.title);
        assert.equal(s.description, t.meta.description);
        assert.equal(s.updated, t.meta.updated);
        assert.equal(s.sources, t.meta.sources.length);
        assert.equal(s.minutes, readingMinutes(wordCount(t.body), lang));
        assert.ok(s.minutes >= 1);
      }
    }
  });

  it("reads one topic: the rendered page with its contents and sources", () => {
    const page = readTopicIn(DIR, "en", "progression");
    assert.ok(page);
    const t = /** @type {ReturnType<typeof renderMarkdown>} */ (TOPICS.get("progression")?.en);
    assert.equal(page.slug, "progression");
    assert.equal(page.title, t.meta.title);
    assert.equal(page.html, t.html);
    assert.deepEqual(page.toc, t.toc);
    assert.deepEqual(page.sources, t.meta.sources);
    assert.equal(page.order, t.meta.order);
  });

  it("returns null for unknown slugs, unsafe slugs and other languages", () => {
    assert.equal(readTopicIn(DIR, "en", "no-such-topic"), null);
    assert.equal(readTopicIn(DIR, "en", "../science/safety"), null);
    assert.equal(readTopicIn(DIR, "en", "Safety"), null);
    assert.equal(readTopicIn(DIR, /** @type {any} */ ("de"), "safety"), null);
  });

  it("works with whatever files exist: ignores other names, lists per language, orders by order then slug", () => {
    const dir = tempDir({
      "b-topic.en.md": topic("B topic", 2),
      "a-topic.en.md": topic("A topic", 2),
      "first.en.md": topic("First", 1),
      "first.ru.md": topic("Первая", 1),
      "notes.txt": "not a topic",
      "Bad_Name.en.md": topic("Bad", 0),
      "draft.de.md": topic("Entwurf", 0),
      "x.en.md.bak": topic("Backup", 0),
    });
    assert.deepEqual([...topicFiles(dir).keys()].sort(), ["a-topic", "b-topic", "first"]);
    assert.deepEqual(listTopicsIn(dir, "en").map((t) => t.slug), ["first", "a-topic", "b-topic"]);
    assert.deepEqual(listTopicsIn(dir, "ru").map((t) => [t.slug, t.title]), [["first", "Первая"]]);
    assert.equal(readTopicIn(dir, "ru", "a-topic"), null);
    assert.deepEqual(listTopicsIn(path.join(dir, "missing"), "en"), []);
  });

  it("lists a topic without a title or a readable order under its slug, at order 0 (first)", () => {
    const untitled = ["---", "description: Draft.", "updated: 2026-11-08", "order: two", "---", "", "Draft text."].join("\n");
    const dir = tempDir({ "draft-topic.en.md": untitled, "first.en.md": topic("First", 1) });
    const list = listTopicsIn(dir, "en");
    assert.deepEqual(list.map((t) => [t.slug, t.title, t.order, t.sources, t.minutes]), [["draft-topic", "draft-topic", 0, 0, 1], ["first", "First", 1, 1, 1]]);
    const page = readTopicIn(dir, "en", "draft-topic");
    assert.deepEqual([page?.title, page?.order, page?.description], ["draft-topic", 0, "Draft."]);
  });

  it("reading time: about 220 words a minute in English, 180 in Russian, at least one minute", () => {
    assert.deepEqual([readingMinutes(0, "en"), readingMinutes(1100, "en"), readingMinutes(1100, "ru"), readingMinutes(1700, "ru")], [1, 5, 6, 9]);
  });
});

describe("science.ts (what the science pages import)", async () => {
  // The pages read content/fitness/science relative to the working directory (Next.js builds from the project root).
  process.chdir(ROOT);
  const emitWarning = process.emitWarning;
  process.emitWarning = function (warning, ...rest) {
    const code = typeof rest[0] === "object" && rest[0] ? /** @type {any} */ (rest[0]).code : rest[1];
    if (code === "MODULE_TYPELESS_PACKAGE_JSON") return;
    return emitWarning.call(this, warning, ...rest);
  };
  const science = await import("../../src/lib/fitness/science.ts");

  it("topicSlugs (generateStaticParams) and listTopics follow the files, in the index order", () => {
    for (const lang of LANGS) {
      assert.deepEqual(science.listTopics(lang), listTopicsIn(DIR, lang));
      assert.deepEqual(science.topicSlugs(lang), listTopicsIn(DIR, lang).map((t) => t.slug));
      const known = ["goals", "progression", "safety", "longevity", "nutrition", "analytics"];
      assert.deepEqual(science.topicSlugs(lang).filter((slug) => known.includes(slug)), known, `${lang}: the six explainers in their order`);
    }
  });

  it("getTopic renders a page, and refuses unknown or unsafe slugs", () => {
    const page = science.getTopic("ru", "safety");
    assert.deepEqual(page, readTopicIn(DIR, "ru", "safety"));
    assert.equal(page?.title, TOPICS.get("safety")?.ru?.meta.title);
    assert.match(page?.html ?? "", /<h2 id="/);
    assert.equal(science.getTopic("en", "../science/safety"), null);
    assert.equal(science.getTopic("en", "no-such-topic"), null);
  });
});

/* ------------------------------------------------------------------ safety.json */

/** @param {unknown} x */
const isText2 = (x) => {
  const t = /** @type {any} */ (x);
  return Boolean(t) && typeof t.en === "string" && typeof t.ru === "string" && t.en.trim() !== "" && t.ru.trim() !== "";
};

describe("safety.json", () => {
  it("prescribes the warm-up the engine plans (templates.json)", () => {
    assert.ok(isText2(safety.warmup.general));
    assert.deepEqual(safety.warmup.ramp, templates.warmupRamp);
    assert.deepEqual(safety.warmup.heavy, { pctE1rm: templates.warmup.heavyPctE1rm, totalReps: templates.warmup.heavyTotalReps });
    assert.equal(safety.warmup.minutes, templates.warmup.minutes);
    for (const rule of safety.warmup.rules ?? []) assert.ok(isText2(rule));
  });

  it("has a pain traffic light green → amber → red that covers 0–10 without gaps", () => {
    assert.deepEqual(safety.pain.map((p) => p.level), ["green", "amber", "red"]);
    let next = 0;
    for (const p of safety.pain) {
      const [lo, hi] = p.range;
      assert.equal(lo, next, `${p.level} starts at ${next}`);
      assert.ok(hi >= lo);
      assert.ok(isText2(p.action));
      next = hi + 1;
    }
    assert.equal(next, 11);
  });

  it("has bilingual red flags and recovery rules", () => {
    assert.ok(safety.redFlags.length >= 3 && safety.redFlags.every(isText2));
    assert.ok(safety.recovery.length >= 3 && safety.recovery.every(isText2));
  });

  it("keys cues by registry classes and covers every class of the owner's program and legs add-on", () => {
    const classes = new Set(registry.classes.map((c) => c.id));
    for (const id of Object.keys(safety.families)) assert.ok(classes.has(id), `${id} is not a registry class`);
    /** @type {Set<string>} */
    const used = new Set();
    /** @param {unknown} v */
    const walk = (v) => {
      if (typeof v === "string" && registry.exercises[v]) used.add(registry.exercises[v].class);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(registry.ownerTemplate);
    assert.ok(used.size >= 10);
    for (const c of used) assert.ok(safety.families[c], `no cues for class ${c}`);
    for (const [id, f] of Object.entries(safety.families)) {
      assert.ok(f.cues.en.length >= 3, `${id}: cues`);
      assert.equal(f.cues.ru.length, f.cues.en.length, `${id}: one Russian cue per English cue`);
      assert.ok([...f.cues.en, ...f.cues.ru].every((c) => typeof c === "string" && c.trim() !== ""));
      assert.ok(isText2(f.risks), `${id}: risks`);
    }
  });

  it("cites sources by the safety explainer's numbers", () => {
    const ids = safety.sources.map((s) => s.id);
    assert.deepEqual(ids, ids.map((_, k) => k + 1));
    /** @type {number[]} */
    const refs = [];
    /** @param {unknown} v @param {string} key */
    const walk = (v, key) => {
      if (key === "source") (Array.isArray(v) ? v : [v]).forEach((n) => refs.push(/** @type {number} */ (n)));
      else if (Array.isArray(v)) v.forEach((x) => walk(x, ""));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "sources") walk(x, k);
    };
    walk(safety, "");
    assert.ok(refs.length > 0);
    for (const n of refs) assert.ok(ids.includes(n), `source ${n} is not in safety.json sources`);
    for (const lang of LANGS) {
      const page = TOPICS.get("safety")?.[lang];
      assert.ok(page, `safety.${lang}.md`);
      const byN = new Map(page.meta.sources.map((s) => [s.n, s.url]));
      for (const s of safety.sources) assert.equal(byN.get(s.id), s.url, `safety.${lang}.md [${s.id}] has another URL`);
    }
  });
});

/* ------------------------------------------------------------------ the progression explainer vs the engine */

/**
 * Body rows of the first table after a `## heading`. @param {string} body @param {string} heading
 * @returns {string[][]}
 */
function tableAfter(body, heading) {
  const lines = body.split("\n");
  let i = lines.findIndex((l) => l.trim() === `## ${heading}`);
  assert.ok(i >= 0, `## ${heading} not found`);
  while (i < lines.length && !lines[i].trim().startsWith("|")) i++;
  /** @type {string[][]} */
  const rows = [];
  for (let j = i + 2; j < lines.length && lines[j].trim().startsWith("|"); j++) {
    rows.push(lines[j].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  }
  return rows;
}

/** "45 × 6, 6, 6 (RIR 1), 5 (RIR 0)" → sets; a bare number repeats the previous weight. */
const SET_RE = /(\d+(?:[.,]\d+)?)\s*×\s*(\d+)(?:\s*\(RIR\s*(\d+)\))?|,\s*(\d+)\b(?!\s*×)(?:\s*\(RIR\s*(\d+)\))?/g;
/** @param {string} cell @param {number} rir */
function parseLogged(cell, rir) {
  /** @type {{ kg: number, reps: number, rir: number }[]} */
  const sets = [];
  let kg = Number.NaN;
  for (const m of cell.matchAll(SET_RE)) {
    if (m[1] !== undefined) {
      kg = Number(m[1].replace(",", "."));
      sets.push({ kg, reps: Number(m[2]), rir: m[3] !== undefined ? Number(m[3]) : rir });
    } else {
      assert.ok(Number.isFinite(kg), `"${cell}": a weight must come first`);
      sets.push({ kg, reps: Number(m[4]), rir: m[5] !== undefined ? Number(m[5]) : rir });
    }
  }
  return sets;
}

const EXAMPLE = {
  en: { heading: "A worked example", progressed: /^Progressed$/, held: /^Held$/, miss: /^Miss (\d+) of (\d+)$/, e1rm: /from (\d+) to (\d+) kg/ },
  ru: { heading: "Разобранный пример", progressed: /^Прогресс$/, held: /^Без изменений$/, miss: /^Неудача (\d+) из (\d+)$/, e1rm: /с (\d+) до (\d+) кг/ },
};

describe("progression explainer", () => {
  const created = "2026-11-02T08:00:00.000Z";
  const program = buildProgram({ templateId: "owner-3day-upper", goal: "recomp", now: created });
  const slotA1 = program.days.find((d) => d.key === "A")?.slots.find((s) => s.slotId === "A1");
  const chestPress = exerciseById("machine-chest-press");

  it("uses the owner's slot A1 as the example: chest press machine, 4 × 6–10 at RIR 2, 5 kg steps", () => {
    assert.ok(slotA1 && chestPress);
    assert.equal(slotA1.exerciseId, "machine-chest-press");
    assert.equal(slotA1.sets, 4);
    assert.deepEqual(slotA1.repRange, [6, 10]);
    assert.equal(slotA1.rir, 2);
    assert.equal(chestPress.increment, 5);
  });

  for (const lang of LANGS) {
    it(`${lang}: the worked example is the engine's own output`, () => {
      assert.ok(slotA1 && chestPress);
      const page = TOPICS.get("progression")?.[lang];
      assert.ok(page, `progression.${lang}.md`);
      const L = EXAMPLE[lang];
      const rows = tableAfter(page.body, L.heading);
      assert.ok(rows.length >= 8, "example rows");
      const params = slotParams(program, slotA1);
      const t0 = Date.parse("2026-11-10T08:00:00.000Z");
      let state = initialState(chestPress, { goal: "recomp", repRange: params.repRange, rir: params.rir, now: t0 });
      /** @type {number[]} */
      const e1rms = [];
      rows.forEach((cells, k) => {
        const [, logged, outcomeText, target] = cells;
        const at = t0 + k * 7 * 86_400_000;
        const sets = parseLogged(logged, params.rir).map((s, i) => ({
          id: `x${k}-${i}`, sessionId: `s${k}`, slotId: "A1", exerciseId: chestPress.id, setIndex: i, kind: "working",
          plannedKg: s.kg, plannedReps: s.reps, kg: s.kg, reps: s.reps, rir: s.rir,
          doneAt: new Date(at + i * 180_000).toISOString(), updatedAt: new Date(at + i * 180_000).toISOString(),
        }));
        assert.ok(sets.length >= 2, `row ${k + 1}: "${logged}"`);
        const r = nextState(state, sets, params, chestPress, at);
        state = r.state;
        e1rms.push(state.e1rm);
        const m = /^(\d+(?:[.,]\d+)?)\s*×\s*(\d+)$/.exec(target);
        assert.ok(m, `row ${k + 1}: next target "${target}"`);
        assert.deepEqual([state.workingKg, state.targetReps], [Number(m[1].replace(",", ".")), Number(m[2])], `row ${k + 1}`);
        if (L.progressed.test(outcomeText)) assert.equal(r.outcome, "progressed", `row ${k + 1}`);
        else if (L.held.test(outcomeText)) assert.equal(r.outcome, "held", `row ${k + 1}`);
        else {
          const miss = L.miss.exec(outcomeText);
          if (miss) {
            assert.equal(r.outcome, "failed", `row ${k + 1}`);
            assert.equal(state.fails, Number(miss[1]));
            assert.equal(params.failsBeforeDeload, Number(miss[2]));
          }
        }
      });
      const e = L.e1rm.exec(page.body);
      assert.ok(e, "the e1RM sentence");
      assert.deepEqual([Math.round(e1rms[0]), Math.round(e1rms[e1rms.length - 1])], [Number(e[1]), Number(e[2])]);
    });
  }

  it("quotes the engine's parameters (templates.json); update the page when these change", () => {
    const R = templates.rules;
    assert.equal(R.rirTolerance, 1);
    assert.equal(R.reliableTotalReps, 12);
    assert.equal(R.maxWidenReps, 2);
    assert.equal(R.doubleStepCapPct, 10);
    assert.equal(R.calibrationExtraRir, 1);
    assert.equal(R.startLoadFactor, 0.85);
    assert.equal(R.bodyweightExponent, 0.67);
    assert.deepEqual(R.gap, { keepBelowDays: 14, shortPct: [5, 10], longFromDays: 28, longPct: [10, 15], longFullAtDays: 90 });
    assert.equal(R.conversion.firstSessionFactor, 0.95);
    assert.deepEqual(R.deload, { setsMultiplier: 0.6, loadMultiplier: 1, rirBonus: 2, repsMinus: 2 });
    assert.equal(R.substitution.base, 0.85);
    assert.equal(R.substitution.differentPattern, 0.6);
    // rule 5: "2 top sessions in a row, 3 after a second deload, with 2 more reps in hand" = min(maxSessions, 1 + times)
    // and spareReps
    assert.deepEqual(R.plateau, { maxSessions: 3, spareReps: 2 });
    const modes = templates.goalModes;
    for (const [id, m] of Object.entries(modes)) {
      assert.equal(m.progression.rule, "double", id);
      assert.equal(m.progression.stepPct, id === "endurance" ? 5 : 2.5, id);
      assert.equal(m.progression.overshootReps, id === "endurance" ? 3 : 2, id);
      assert.equal(m.progression.failsBeforeDeload, id === "strength" ? 3 : 2, id);
      assert.equal(m.progression.deloadPct, 10, id);
      assert.equal(m.blockWeeks, id === "maintenance" ? 8 : 5, id);
    }
    assert.equal(Math.round(maxStepFraction(6, 10, 2) * 1000) / 10, 10.5);
    assert.equal(45 / 40 - 1 > maxStepFraction(6, 10, 2), true);
    assert.equal(45 / 40 - 1 < maxStepFraction(6, 11, 2), true);
  });

  it("deload weeks are weeks 6, 12, 18 … of the owner's program", () => {
    const at = (/** @type {number} */ week) => Date.parse(created) + ((week - 1) * 7 + 3) * 86_400_000;
    const due = [];
    for (let week = 1; week <= 18; week++) if (deloadWeek(program, at(week)).due) due.push(week);
    assert.deepEqual(due, [6, 12, 18]);
  });

  it("states the owner's rep ranges and RIR exactly as the template sets them", () => {
    /** @type {[string[], [number, number], number][]} */
    const quoted = [
      [["machine-chest-press", "lat-pulldown", "machine-row", "seated-cable-row"], [6, 10], 2],
      [["machine-incline-press", "machine-shoulder-press", "assisted-pull-up", "triceps-press-machine"], [8, 12], 2],
      [["pec-deck", "cable-fly", "machine-preacher-curl", "hammer-curl", "cable-pushdown"], [10, 15], 1],
      [["machine-lateral-raise", "face-pull"], [12, 20], 1],
    ];
    const slots = program.days.flatMap((d) => d.slots);
    for (const [ids, range, rir] of quoted) {
      for (const id of ids) {
        const slot = slots.find((s) => s.exerciseId === id);
        assert.ok(slot, `${id} is in the program`);
        assert.deepEqual([slot.repRange, slot.rir], [range, rir], id);
      }
    }
    assert.deepEqual(program.days.map((d) => d.key), ["A", "B", "C"]);
    assert.equal(program.daysPerWeek, 3);
  });
});
