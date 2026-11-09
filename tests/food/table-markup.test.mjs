import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cookingTablesHtml } from '../../src/lib/food/table-markup.mjs';

const text = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tableHtml = (value) => typeof value === 'string' ? value.includes('<table') ? [value] : [] : Array.isArray(value) ? value.flatMap(tableHtml) : value && typeof value === 'object' ? Object.values(value).flatMap(tableHtml) : [];

test('all authored English/Russian cooking tables retain exact visible data and live quantity attributes', () => {
  let checked = 0;
  for (const lang of ['en', 'ru']) {
    const dir = new URL(`../../content/${lang}/recipes/`, import.meta.url);
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const recipe = JSON.parse(fs.readFileSync(path.join(dir.pathname, name), 'utf8'));
      for (const html of tableHtml(recipe)) {
        const result = cookingTablesHtml(html, lang);
        assert.equal(text(result.replace(/<p class="cooking-table-hint">[\s\S]*?<\/p>/g, '')), text(html), `${lang}/${name}: values and units unchanged`);
        assert.deepEqual([...result.matchAll(/<span\b[^>]*\bdata-k=[^>]*>/g)].map((m) => m[0]), [...html.matchAll(/<span\b[^>]*\bdata-k=[^>]*>/g)].map((m) => m[0]), 'ingredient scaling hooks unchanged');
        assert.equal((result.match(/<table\b/g) ?? []).length, (html.match(/<table\b/g) ?? []).length);
        assert.ok(result.includes('tabindex="0"') && result.includes('role="region"'));
        assert.ok(result.includes(lang === 'ru' ? 'Таблица приготовления' : 'Cooking reference table'));
        checked++;
      }
    }
  }
  assert.equal(checked, 10);
});

test('numeric alignment follows column values while descriptive result columns remain text', () => {
  const html = '<table class="mini"><thead><tr><th>Cut</th><th>Time</th><th>Result</th></tr></thead><tbody><tr><td>Small</td><td>10 min</td><td>Soft</td></tr><tr><td>Large</td><td>about 20 min</td><td>Firm</td></tr></tbody></table>';
  const result = cookingTablesHtml(html);
  assert.match(result, /<th class="cooking-number">Time/);
  assert.match(result, /<td class="cooking-number">about 20 min/);
  assert.match(result, /<th>Result/);
  assert.match(result, /<td>Firm/);
});

test('HTML with no table is byte-for-byte unchanged', () => {
  const html = '<p>Cook at <span class="q" data-k="temp">85 °C</span>.</p>';
  assert.equal(cookingTablesHtml(html), html);
});
