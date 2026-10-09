import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const header = readFileSync(new URL("../../src/components/site/SiteHeader.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/styles/site.css", import.meta.url), "utf8");

/** The CSS block that starts with `selector {` (first match), without nested media queries. */
function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `no rule for ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

describe("site header", () => {
  it("keeps the recipe groups on one line that scrolls sideways", () => {
    assert.match(header, /<nav className="group-nav"/);
    const nav = rule(".site-header .group-nav");
    assert.match(nav, /flex-wrap: nowrap/);
    assert.match(nav, /overflow-x: auto/);
    assert.match(nav, /min-width: 0/);
  });

  it("does not prefetch the home and travel pages from recipe pages", () => {
    assert.match(header, /className="home-link" href=\{home\} prefetch=\{false\}/);
    assert.match(header, /className="nav-section" prefetch=\{false\}/);
  });

  it("fails loudly when a rule is missing", () => {
    assert.throws(() => rule(".no-such-rule"), assert.AssertionError);
  });
});
