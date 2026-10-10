import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { sousVideTiming, duration } from '../../src/lib/sous-vide.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const read = (lang, slug) => JSON.parse(fs.readFileSync(path.join(root, 'content', lang, `${slug}.json`)));
const timing = (input = {}) => sousVideTiming({ food: 'meat', state: 'chilled', mm: 25, temperature: 57, ...input });
const text = html => html.replace(/<[^>]*>/g, '');

describe('thickness timing lookup', () => {
  it('uses separate published frozen rows and rounds measurements upwards', () => {
    assert.equal(timing().minutes, 75);
    assert.equal(timing({ state: 'frozen' }).minutes, 105);
    assert.equal(timing({ mm: 40, shape: 'cylinder' }).minutes, 75);
    assert.equal(timing({ mm: 40, shape: 'cylinder', state: 'frozen' }).minutes, 120);
    assert.equal(timing({ mm: 26, state: 'frozen' }).minutes, 135);
    assert.equal(timing({ mm: 26 }).usedMm, 30);
    assert.equal(timing().kind, 'heating');
  });

  it('rejects unsupported sizes, states, shapes and temperatures instead of clamping', () => {
    for (const mm of [NaN, Infinity, -1, 0, 4.9, 50.1]) assert.equal(timing({ mm }).error, 'size');
    assert.equal(timing({ state: 'room-temperature' }).error, 'size');
    for (const temperature of [NaN, 44, 81]) assert.equal(timing({ temperature }).error, 'temperature');
    assert.equal(timing({ shape: 'unknown' }).error, 'temperature');
    assert.equal(timing({ mm: 45, state: 'frozen', temperature: 54 }).error, 'long');
    assert.equal(timing({ mm: 45, state: 'frozen', temperature: 55 }).minutes, 270);
  });

  it('keeps soft salmon recipe timings separate from meat and pasteurization', () => {
    const salmon = input => timing({ food: 'salmon', temperature: 50, ...input });
    assert.equal(salmon({ mm: 13 }).minutes, 30);
    assert.equal(salmon({ mm: 25 }).minutes, 40);
    assert.equal(salmon({ mm: 25, state: 'frozen' }).minutes, 60);
    assert.equal(salmon({ mm: 26, state: 'frozen' }).minutes, 90);
    assert.equal(salmon({ mm: 26 }).usedMm, 38);
    assert.equal(salmon({}).kind, 'recipe');
    assert.equal(salmon({ state: 'frozen' }).approximate, true);
    assert.equal(salmon({ mm: 39 }).error, 'size');
    assert.equal(salmon({ temperature: 60 }).error, 'temperature');
  });

  it('requires fridge thawing before applying chilled lean-fish pasteurization times', () => {
    const fish = input => timing({ food: 'lean-fish', temperature: 60, ...input });
    assert.equal(fish({}).minutes, 75);
    assert.equal(fish({}).kind, 'pasteurization');
    assert.equal(fish({}).thawFirst, false);
    assert.equal(fish({ state: 'frozen' }).thawFirst, true);
    assert.equal(fish({ state: 'frozen' }).minutes, 75);
    assert.equal(fish({ mm: 26 }).minutes, 105);
    assert.equal(fish({ mm: 41 }).error, 'size');
    assert.equal(fish({ temperature: 50 }).error, 'temperature');
    assert.equal(fish({ shape: 'sphere' }).error, 'temperature');
    assert.equal(duration(105), '1 h 45 min');
    assert.equal(duration(120, 'ru'), '2 ч');
  });
});

describe('published sous-vide content', () => {
  it('provides locale-independent starting-state metadata for every row and matching printable PDFs', () => {
    for (const lang of ['en', 'ru']) {
      const sv = read(lang, 'sous-vide');
      for (const table of sv.tables) {
        assert.equal(table.states.length, table.rows.length, table.id);
        assert.ok(table.states.includes('chilled'), table.id);
        assert.ok(table.states.includes('frozen'), table.id);
        for (const state of table.states) assert.ok(['chilled', 'frozen', 'both'].includes(state));
      }
      const fatty = sv.tables.find(t => t.id === 'salmon-pasteurized');
      const lean = sv.tables.find(t => t.id === 'lean-fish');
      assert.match(fatty.rows[8][4], /90/);
      assert.match(lean.rows[8][4], /75/);
      for (const table of [fatty, lean]) {
        for (const [i, row] of table.rows.entries()) {
          if (table.states[i] === 'frozen') assert.match(row[4], lang === 'en' ? /Thaw, then/ : /размороз/i);
        }
      }
      assert.match(sv.pdf.src, lang === 'en' ? /v5\.pdf/ : /v5_ru\.pdf/);
      const pdf = fs.readFileSync(path.join(root, 'public/media', sv.pdf.src.split('?')[0]));
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    }
  });

  it('publishes four illustrated recipes in both languages, with distinct pictures at every stage', () => {
    const slugs = ['sous-vide-fries', 'sous-vide-salmon', 'jumbo-shrimp-tempura', 'king-oyster-tempura'];
    for (const lang of ['en', 'ru']) for (const slug of slugs) {
      const r = read(lang, `recipes/${slug}`);
      assert.equal(r.steps.length, slug === 'sous-vide-fries' ? 5 : 4);
      const hashes = new Set();
      for (const step of r.steps) {
        const im = step.images;
        assert.equal(im.diagram, null);
        assert.equal(im.photo, null);
        assert.equal(im.svg_fallback, null);
        assert.ok(im.illustration);
        const bytes = fs.readFileSync(path.join(root, 'public/media', im.illustration.split('?')[0]));
        hashes.add(createHash('sha256').update(bytes).digest('hex'));
      }
      assert.equal(hashes.size, r.steps.length);
      assert.equal(r.hero.image, r.steps.at(-1).images.illustration);
      assert.ok(r.sources.length);
    }
  });

  it('keeps the brine, drying, first fry, freezing and final fry sequence explicit', () => {
    const r = read('en', 'recipes/sous-vide-fries');
    assert.match(text(r.steps[0].body_html), /18 mm square/);
    assert.match(text(r.steps[1].body_html), /90 °C.*25 minutes/);
    assert.match(text(r.steps[2].body_html), /no surface water.*130 °C.*8 minutes/);
    assert.match(text(r.steps[3].body_html), /Cool.*Freeze.*solid/);
    assert.match(text(r.steps[4].body_html), /190 °C.*frozen.*3 minutes/);
    assert.match(JSON.stringify(r.notes), /not both/);
    const shrimp = read('en', 'recipes/jumbo-shrimp-tempura');
    assert.match(text(shrimp.steps[0].body_html), /3 shallow cuts across the belly/);
    assert.match(text(shrimp.steps[2].body_html), /63 °C/);
    const mushroom = read('en', 'recipes/king-oyster-tempura');
    assert.match(text(mushroom.steps[0].body_html), /5 mm slices/);
  });
});
