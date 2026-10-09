import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractAssetUrls, sameOriginPath } from "../../src/lib/offline/assets.mjs";
import { buildCatalog, formatBytes, savedTripUrls, skipPublicFile } from "../../src/lib/offline/catalog.mjs";

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
