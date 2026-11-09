// Stream 08: the science-page markdown renderer (src/lib/fitness/markdown.mjs).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  escapeHtml, parseFrontMatter, parseSource, plainText, renderBody, renderMarkdown, safeHref, slugify, wordCount,
} from "../../src/lib/fitness/markdown.mjs";

const html = (md, opts) => renderBody(md, opts).html;
const FM = [
  "---",
  "title: Progression",
  "description: How the weights move.",
  "updated: 2026-11-08",
  "order: 2",
  "sources:",
  "- [1] Progressive overload without progressing load? — PeerJ, 2022. https://doi.org/10.7717/peerj.14142",
  "- [2] Does taking a break matter — adaptations in muscle strength and size — Scandinavian Journal of Medicine & Science in Sports, 2024. https://doi.org/10.1111/sms.14739",
  "---",
  "",
].join("\n");

describe("front matter", () => {
  it("reads title, description, updated, order and numbered sources", () => {
    const { meta, body, errors } = parseFrontMatter(`${FM}Body [1].\n`);
    assert.deepEqual(errors, []);
    assert.equal(meta.title, "Progression");
    assert.equal(meta.description, "How the weights move.");
    assert.equal(meta.updated, "2026-11-08");
    assert.equal(meta.order, 2);
    assert.equal(meta.sources.length, 2);
    assert.equal(body, "Body [1].\n");
  });

  it("splits a source at its last dash, so titles may contain one", () => {
    const { meta } = parseFrontMatter(FM);
    assert.deepEqual(meta.sources[1], {
      n: 2,
      text: "Does taking a break matter — adaptations in muscle strength and size — Scandinavian Journal of Medicine & Science in Sports, 2024.",
      title: "Does taking a break matter — adaptations in muscle strength and size",
      outlet: "Scandinavian Journal of Medicine & Science in Sports",
      year: "2024",
      url: "https://doi.org/10.1111/sms.14739",
    });
    assert.deepEqual(parseSource("[7] A book — Human Kinetics, 2019."), {
      n: 7, text: "A book — Human Kinetics, 2019.", title: "A book", outlet: "Human Kinetics", year: "2019", url: null,
    });
    assert.equal(parseSource("no number here"), null);
  });

  it("accepts quoted values, CRLF line ends and a byte-order mark", () => {
    const text = "﻿---\r\ntitle: \"Quoted: yes\"\r\ndescription: 'Single'\r\nupdated: 2026-11-08\r\norder: 3\r\n---\r\nText";
    const { meta, body, errors } = parseFrontMatter(text);
    assert.deepEqual(errors, []);
    assert.equal(meta.title, "Quoted: yes");
    assert.equal(meta.description, "Single");
    assert.equal(body, "Text");
  });

  it("lists what is missing or wrong instead of throwing", () => {
    const bad = parseFrontMatter("---\ntitle: X\nupdated: 8 Nov\norder: two\nauthor: me\nsources:\n- [2] Late — PeerJ, 2020.\n---\nBody");
    assert.ok(bad.errors.includes("missing description"));
    assert.ok(bad.errors.includes("updated must be YYYY-MM-DD"));
    assert.ok(bad.errors.includes("order must be an integer"));
    assert.ok(bad.errors.includes("unknown key: author"));
    assert.ok(bad.errors.some((e) => e.includes("[2] is out of sequence")));
    const none = parseFrontMatter("# Just markdown");
    assert.deepEqual(none.errors, ["no front matter"]);
    assert.equal(none.body, "# Just markdown");
  });
});

describe("headings and contents", () => {
  it("gives every heading a unique slug id and lists h2/h3 in the contents", () => {
    const { html: out, toc } = renderBody("# Top\n\n## What this means for me\n\n### Sets *and* reps [1]\n\n## What this means for me\n\n#### Deep");
    assert.match(out, /<h1 id="top">Top<\/h1>/);
    assert.match(out, /<h2 id="what-this-means-for-me">What this means for me<\/h2>/);
    assert.match(out, /<h3 id="sets-and-reps">Sets <em>and<\/em> reps <sup class="fit-cite">/);
    assert.match(out, /<h2 id="what-this-means-for-me-2">/);
    assert.match(out, /<h4 id="deep">Deep<\/h4>/);
    assert.deepEqual(toc, [
      { id: "what-this-means-for-me", text: "What this means for me", level: 2 },
      { id: "sets-and-reps", text: "Sets and reps", level: 3 },
      { id: "what-this-means-for-me-2", text: "What this means for me", level: 2 },
    ]);
  });

  it("keeps Cyrillic slugs and never reuses the page's own ids", () => {
    const { toc } = renderBody("## Что это значит для меня\n\n## Sources\n\n## Src 1\n\n## !!!");
    assert.deepEqual(toc.map((t) => t.id), ["что-это-значит-для-меня", "sources-2", "src-1-2", "section"]);
    assert.equal(slugify("Theil–Sen: robust trends"), "theil-sen-robust-trends");
  });

  it("does not take #hashtags or C# for headings", () => {
    assert.equal(html("#hashtag"), "<p>#hashtag</p>");
    assert.match(html("## Written in C#"), /<h2 id="written-in-c">Written in C#<\/h2>/);
  });
});

describe("inline formatting", () => {
  it("renders bold, italic, both, and code", () => {
    assert.equal(html("**bold** and *italic* and _also_ and ***both*** and `x < y`"),
      "<p><strong>bold</strong> and <em>italic</em> and <em>also</em> and <strong><em>both</em></strong> and <code>x &lt; y</code></p>");
    assert.equal(html("**bold *nested* bold**"), "<p><strong>bold <em>nested</em> bold</strong></p>");
    assert.equal(html("`` a `tick` ``"), "<p><code>a `tick`</code></p>");
  });

  it("leaves lone stars, snake_case and spaced asterisks alone", () => {
    assert.equal(html("2 * 3 * 4 and snake_case_name and **not closed"), "<p>2 * 3 * 4 and snake_case_name and **not closed</p>");
    assert.equal(html("\\*escaped\\* and \\[1\\]"), "<p>*escaped* and [1]</p>");
  });

  it("links http(s) and relative targets, localises site paths on Russian pages", () => {
    assert.equal(html("[study](https://doi.org/10.1/x)"),
      '<p><a href="https://doi.org/10.1/x" rel="noopener noreferrer" target="_blank">study</a></p>');
    assert.equal(html("[progress](/fitness/progress)"), '<p><a href="/fitness/progress">progress</a></p>');
    assert.equal(html("[прогресс](/fitness/progress)", { lang: "ru" }), '<p><a href="/ru/fitness/progress">прогресс</a></p>');
    assert.equal(html("[уже](/ru/fitness/progress)", { lang: "ru" }), '<p><a href="/ru/fitness/progress">уже</a></p>');
    assert.equal(html("[file](/media/fitness/a.webp)", { lang: "ru" }), '<p><a href="/media/fitness/a.webp">file</a></p>');
    assert.equal(html("[up](#sources)"), '<p><a href="#sources">up</a></p>');
    assert.equal(html('[wiki](https://en.wikipedia.org/wiki/Foo_(bar) "Foo")'),
      '<p><a href="https://en.wikipedia.org/wiki/Foo_(bar)" title="Foo" rel="noopener noreferrer" target="_blank">wiki</a></p>');
    assert.equal(html("[**bold** link](/x)"), '<p><a href="/x"><strong>bold</strong> link</a></p>');
  });

  it("refuses scripts, data, protocol-relative and disguised targets (the text stays)", () => {
    for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "vbscript:x", "mailto:a@b.c", "//evil.example", "/\\evil.example"]) {
      assert.equal(safeHref(bad), null, bad);
      assert.equal(html(`[click](${bad})`), "<p>click</p>", bad);
    }
    assert.equal(safeHref("java\tscript:alert(1)"), null);
    assert.equal(safeHref("https://"), null);
    assert.equal(safeHref("/"), "/");
    assert.equal(safeHref("/", "ru"), "/ru");
  });
});

describe("citations", () => {
  const sources = parseFrontMatter(FM).meta.sources;
  it("turns [n] into a superscript link to #src-n with the source as a tooltip", () => {
    assert.equal(html("Reps count [1].", { sources }),
      '<p>Reps count <sup class="fit-cite"><a href="#src-1" aria-label="Source 1" title="Progressive overload without progressing load? (2022)">1</a></sup>.</p>');
    assert.match(html("Повторы [1].", { lang: "ru", sources }), /aria-label="Источник 1"/);
  });

  it("merges adjacent markers, lists and ranges into one superscript", () => {
    const out = html("See [2][5], [1, 3] and [4–6].");
    assert.match(out, /<sup class="fit-cite"><a href="#src-2"[^>]*>2<\/a>, <a href="#src-5"[^>]*>5<\/a><\/sup>,/);
    assert.match(out, /<a href="#src-1"[^>]*>1<\/a>, <a href="#src-3"[^>]*>3<\/a><\/sup> and/);
    assert.deepEqual(renderBody("[4–6] [7-8]").cites, [4, 5, 6, 7, 8]);
  });

  it("is not a citation when it is a link, code, or escaped", () => {
    assert.equal(html("[1](/x)"), '<p><a href="/x">1</a></p>');
    assert.deepEqual(renderBody("`[3]` and \\[4]").cites, []);
  });

  it("reports citations without a source", () => {
    const { errors } = renderMarkdown(`${FM}Fine [1][2], missing [3].`);
    assert.deepEqual(errors, ["citation [3] has no source"]);
  });
});

describe("lists", () => {
  it("renders bullets with one nested level and continuation lines", () => {
    assert.equal(html("- one\n  continued\n- two\n  - nested a\n  - nested b\n- three"),
      "<ul><li>one\ncontinued</li><li>two<ul><li>nested a</li><li>nested b</li></ul></li><li>three</li></ul>");
  });

  it("renders ordered lists, keeps the start number and nests the other type", () => {
    assert.equal(html("3. three\n4. four\n   - detail"), '<ol start="3"><li>three</li><li>four<ul><li>detail</li></ul></li></ol>');
    assert.equal(html("1) a\n2) b"), "<ol><li>a</li><li>b</li></ol>");
  });

  it("keeps a loose list together and ends it at a paragraph", () => {
    assert.equal(html("- a\n\n- b\n\nAfter."), "<ul><li>a</li><li>b</li></ul>\n<p>After.</p>");
    assert.equal(html("- a\n\n1. b"), "<ul><li>a</li></ul>\n<ol><li>b</li></ol>");
  });

  it("does not start a list mid-paragraph with a year", () => {
    assert.equal(html("Published in\n2026. Still text."), "<p>Published in\n2026. Still text.</p>");
  });
});

describe("tables", () => {
  it("renders a pipe table with alignment inside a focusable scroll box", () => {
    const out = html("| Reps | Load | Note |\n| :--- | ---: | :---: |\n| 6 | **40** kg | a \\| b |\n| 7 |");
    assert.equal(out,
      '<div class="fit-table" role="region" tabindex="0" aria-label="Table: Reps, Load, Note"><table><thead><tr>' +
      '<th scope="col">Reps</th><th scope="col" class="al-r">Load</th><th scope="col" class="al-c">Note</th></tr></thead><tbody>' +
      '<tr><td>6</td><td class="al-r"><strong>40</strong> kg</td><td class="al-c">a | b</td></tr>' +
      '<tr><td>7</td><td class="al-r"></td><td class="al-c"></td></tr></tbody></table></div>');
    assert.match(html("| a | b |\n|---|---|\n| 1 | 2 |", { lang: "ru" }), /aria-label="Таблица: a, b"/);
  });

  it("needs an alignment row with the same number of cells", () => {
    assert.equal(html("a | b\n--- | ---\n1 | 2"), html("| a | b |\n|---|---|\n| 1 | 2 |").replace(/\n/g, "\n"));
    assert.equal(html("| a | b |\n|---|\n| 1 | 2 |"), "<p>| a | b |\n|---|\n| 1 | 2 |</p>");
  });
});

describe("other blocks", () => {
  it("renders > blocks as a callout with their own paragraphs", () => {
    assert.equal(html("> **In short:** reps first.\n>\n> Then load."),
      '<div class="fit-callout" role="note"><p><strong>In short:</strong> reps first.</p>\n<p>Then load.</p></div>');
  });

  it("renders rules and fenced code (escaped, untouched)", () => {
    assert.equal(html("Above\n\n---\n\nBelow"), "<p>Above</p>\n<hr>\n<p>Below</p>");
    assert.equal(html("```\n<b>*not em*</b> [1]\n```"), "<pre><code>&lt;b&gt;*not em*&lt;/b&gt; [1]</code></pre>");
  });

  it("joins paragraph lines and splits paragraphs on blank lines", () => {
    assert.equal(html("one\ntwo\n\nthree"), "<p>one\ntwo</p>\n<p>three</p>");
  });
});

describe("escaping", () => {
  it("never lets raw HTML through", () => {
    const out = html('<script>alert("x")</script> <img src=x onerror=alert(1)> &amp; "quotes"');
    assert.equal(out, '<p>&lt;script&gt;alert("x")&lt;/script&gt; &lt;img src=x onerror=alert(1)&gt; &amp;amp; "quotes"</p>');
    assert.ok(!/<script|<img/.test(html("## <script>x</script>\n\n| <b> |\n|---|\n| <i> |\n\n- <u>\n\n> <s>")));
  });

  it("escapes quotes inside attributes", () => {
    const out = html('[x](/a "say \\"hi\\" <now>")');
    assert.equal(out, '<p><a href="/a" title="say &quot;hi&quot; &lt;now&gt;">x</a></p>');
    assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});

describe("counting and plain text", () => {
  it("counts words, not citations, link targets, rules or symbols", () => {
    assert.equal(wordCount("Two words [1][2]."), 2);
    assert.equal(wordCount("A [link](https://example.com/a-long/path) here — and 6–10 reps × 3."), 7);
    assert.equal(wordCount("| a | b |\n|---|---|\n| 1 | 2 |"), 4);
    assert.equal(wordCount("Подходы и повторения [3]"), 3);
  });

  it("strips formatting and markers for the contents", () => {
    assert.equal(plainText("**Bold** [link](/x) `code` [4] & more"), "Bold link code & more");
  });

  it("returns meta, html and contents for a whole file", () => {
    const r = renderMarkdown(`${FM}## Two levers [1]\n\nText [2].\n`);
    assert.equal(r.meta.title, "Progression");
    assert.deepEqual(r.toc, [{ id: "two-levers", text: "Two levers", level: 2 }]);
    assert.match(r.html, /^<h2 id="two-levers">/);
    assert.deepEqual(r.errors, []);
  });
});
