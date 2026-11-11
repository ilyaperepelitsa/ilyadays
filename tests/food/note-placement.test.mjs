import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stepConditions } from '../../src/lib/food/step-conditions.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const rules = read('art/recipe-variations/source/src/note_placement.json');
const records = lang => [...fs.readdirSync(`content/${lang}/recipes`).filter(file => file.endsWith('.json'))
  .map(file => read(`content/${lang}/recipes/${file}`)), ...read(`content/${lang}/sashimi.json`)];

test('all authored placement metadata survives export and localization without dropping notes', () => {
  const en = new Map(records('en').map(recipe => [recipe.slug, recipe]));
  const ru = new Map(records('ru').map(recipe => [recipe.slug, recipe]));
  for (const [slug, entries] of Object.entries(rules)) {
    const english = en.get(slug), russian = ru.get(slug);
    assert.equal(english.notes.length, russian.notes.length, slug);
    for (const entry of entries) {
      const i = english.notes.findIndex(note => note.title_html === entry.title);
      assert.ok(i >= 0, `${slug}: ${entry.title}`);
      assert.equal(english.notes[i].placement, entry.placement);
      assert.equal(russian.notes[i].placement, entry.placement);
      assert.equal(english.notes[i].step, entry.step);
      assert.equal(russian.notes[i].step, entry.step);
      assert.ok(russian.notes[i].html);
      if (entry.placement === 'step') assert.ok(entry.step > 0 && entry.step <= english.steps.length);
    }
    assert.equal(english.notes.filter(note => note.placement).length, entries.length, slug);
  }
});

test('unmarked notes retain their default position and variant choices are recipe-owned data', () => {
  for (const lang of ['en', 'ru']) for (const recipe of records(lang)) {
    for (const note of recipe.notes) {
      assert.ok(!note.placement || ['start', 'step'].includes(note.placement));
      assert.ok(note.html && note.title_html);
    }
  }
  const batter = read('content/en/recipes/potato-wedge-tempura.json');
  assert.equal(batter.notes.find(note => note.title_html === 'No packet mix?').placement, 'start');
  assert.equal(batter.notes.find(note => note.title_html === 'A thin shell that sticks to the potato').placement, undefined);
  const pork = read('content/en/recipes/nikumaki-onigiri.json');
  assert.equal(pork.notes.find(note => note.title_html === "Fun inside (this site's)").placement, 'start');
});

test('fan-oven alternatives sit beside baking and also appear in that step temperature table', () => {
  for (const lang of ['en', 'ru']) {
    const recipe = read(`content/${lang}/recipes/mooken-mini-cream-puffs.json`);
    const note = recipe.notes.find(note => note.placement === 'step');
    assert.equal(note.step, 9);
    const step = recipe.steps.find(step => step.n === note.step);
    const rows = stepConditions({ ...step, body_html: step.body_html + note.html });
    assert.ok(rows.some(row => row.html.includes('data-a="140"')));
    assert.ok(rows.some(row => row.html.includes('data-a="180"')));
  }
});
