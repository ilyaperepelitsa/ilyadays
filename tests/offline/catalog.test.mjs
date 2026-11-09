import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractAssetUrls, sameOriginPath } from "../../src/lib/offline/assets.mjs";
import { buildCatalog, fitnessPages, formatBytes, savedTripUrls, skipPublicFile } from "../../src/lib/offline/catalog.mjs";

describe("offline catalog", () => {
  it("lists both languages and skips the duplicate food export", () => {
    const catalog = buildCatalog(
      ["grilled-cheese", "nigiri"],
      [
        { rel: "media/illustrations/nigiri/hero.webp", bytes: 1000 },
        { rel: "food/illustrations/nigiri/hero.webp", bytes: 9_000_000 },
        { rel: "icons/icon-192.png", bytes: 500 },
        { rel: ".DS_Store", bytes: 12 },
      ],
    );
    assert.deepEqual(catalog.pages.slice(0, 2), ["/", "/food"]);
    assert.ok(catalog.pages.includes("/food/grilled-cheese"));
    assert.ok(catalog.pages.includes("/ru/food/grilled-cheese"));
    assert.ok(catalog.pages.includes("/ru"));
    assert.deepEqual(catalog.files, ["/media/illustrations/nigiri/hero.webp", "/icons/icon-192.png"]);
    assert.equal(catalog.bytes, 1500);
    assert.equal(skipPublicFile("food/illustrations/nigiri/hero.webp"), true);
  });

  it("keeps the same id until a file changes size", () => {
    const files = [{ rel: "icons/icon-192.png", bytes: 500 }];
    const first = buildCatalog(["nigiri"], files);
    const again = buildCatalog(["nigiri"], files);
    const grown = buildCatalog(["nigiri"], [{ rel: "icons/icon-192.png", bytes: 800 }]);
    assert.equal(first.id, again.id);
    assert.notEqual(first.id, grown.id);
  });

  it("keeps every fitness exercise and science page in both languages", () => {
    const extra = fitnessPages(["pec-deck", "../etc", "Bad Id"], ["safety"]);
    assert.deepEqual(extra, ["/fitness/exercises/pec-deck", "/fitness/science/safety"]);
    const catalog = buildCatalog(["nigiri"], [], new Map(), [...extra, "/fitness", "javascript:alert(1)"]);
    assert.ok(catalog.pages.includes("/fitness"));
    assert.ok(catalog.pages.includes("/fitness/exercises/pec-deck"));
    assert.ok(catalog.pages.includes("/ru/fitness/exercises/pec-deck"));
    assert.ok(catalog.pages.includes("/ru/fitness/science/safety"));
    assert.equal(catalog.pages.filter((page) => page === "/fitness").length, 1);
    assert.ok(!catalog.pages.some((page) => page.includes("javascript")));
  });

  it("adds saved trips and refuses odd ids", () => {
    assert.deepEqual(savedTripUrls(["abc"]), ["/travel/made/abc", "/ru/travel/made/abc"]);
    assert.deepEqual(savedTripUrls(["../x", ""]), []);
  });

  it("formats the download size", () => {
    assert.equal(formatBytes(1500), "2 KB");
    assert.equal(formatBytes(110_000_000), "110 MB");
  });
});

describe("offline asset urls", () => {
  it("keeps site files and drops everyone else's", () => {
    const html = `
      <img src="/media/illustrations/nigiri/hero.webp">
      <img srcset="/covers/food.webp 1x, /covers/food-2.webp 2x">
      <script src="/_next/static/chunks/app.js"></script>
      <link href="https://example.com/font.css" rel="stylesheet">
      <img src="data:image/gif;base64,aaaa">
    `;
    const script = 'import("/_next/static/chunks/food/page-abc.js")';
    assert.deepEqual(extractAssetUrls(html).sort(), [
      "/_next/static/chunks/app.js",
      "/covers/food-2.webp",
      "/covers/food.webp",
      "/media/illustrations/nigiri/hero.webp",
    ]);
    assert.deepEqual(extractAssetUrls(script), ["/_next/static/chunks/food/page-abc.js"]);
    assert.equal(sameOriginPath("https://www.ilyadays.com/food/nigiri"), "/food/nigiri");
    assert.equal(sameOriginPath("https://evil.example/food"), "");
  });
});

describe("versioned offline copies", () => {
  it("lists a file under the exact ?v= URL pages request, and changes the id when the version does", () => {
    const files = [{ rel: "media/illustrations/nigiri/hero.webp", bytes: 1000 }, { rel: "icons/icon-192.png", bytes: 500 }];
    const v1 = buildCatalog(["nigiri"], files, new Map([["media/illustrations/nigiri/hero.webp", "abc1234567"]]));
    const v2 = buildCatalog(["nigiri"], files, new Map([["media/illustrations/nigiri/hero.webp", "def7654321"]]));
    assert.deepEqual(v1.files, ["/media/illustrations/nigiri/hero.webp?v=abc1234567", "/icons/icon-192.png"]);
    assert.notEqual(v1.id, v2.id);
  });

  it("keeps a page's ?v= so the save does not fetch the same picture twice", () => {
    const html = '<img src="/media/thumbs/illustrations/ramen/4.webp?v=78533e3347&x=1"><img src="/covers/food.webp?utm=1">';
    assert.deepEqual(extractAssetUrls(html).sort(), ["/covers/food.webp", "/media/thumbs/illustrations/ramen/4.webp?v=78533e3347"]);
    assert.equal(sameOriginPath("https://ilyadays.com/apps/istanbul/app.js?v=0123456789"), "/apps/istanbul/app.js?v=0123456789");
    assert.equal(sameOriginPath("/media/a.webp?v=<script>"), "/media/a.webp");
  });
});
