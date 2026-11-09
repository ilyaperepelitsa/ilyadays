import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const index = (lang) => JSON.parse(readFileSync(new URL(`../../content/${lang}/index.json`, import.meta.url), "utf8"));

test("every card picture has its 600 px copy (run scripts/card-thumbnails.py after a sync)", () => {
  for (const lang of ["en", "ru"]) {
    for (const recipe of index(lang).recipes) {
      const image = recipe.hero?.image;
      if (!image || !/^illustrations\/[^?]+\.webp(\?|$)/.test(image)) continue;
      const thumb = new URL(`../../public/media/thumbs/${image.split("?")[0]}`, import.meta.url);
      assert.ok(existsSync(thumb), `${lang} ${recipe.slug}: missing thumbs/${image}`);
    }
  }
});
