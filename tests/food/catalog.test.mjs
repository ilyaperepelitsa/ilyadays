import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { recipeCatalog } from '../../src/lib/food/catalog.mjs';

const record = (slug, added, group = 'potatoes') => ({
  slug, added, title: slug, group: { id: group, name: group },
  blurb_html: '', description: '', yields: '', total: '', chips: [],
  hero: { image: null, svg_fallback: null, alt: slug }, share_image: '',
});
const index = { recipes: [], groups: [], recent: ['stale-export-entry'] };

test('discovers a recipe absent from the export index and creates its group and recent entry', () => {
  const result = recipeCatalog(index, [record('new-recipe', '2026-11-11T10:00:00Z')]);
  assert.deepEqual(result.recent, ['new-recipe']);
  assert.equal(result.recipes[0].kind, 'recipe');
  assert.deepEqual(result.groups[0].items, ['new-recipe']);
});

test('sorts publication dates as instants, supports legacy dates, and preserves ties', () => {
  const records = [record('legacy', undefined), record('newest', '2026-11-11T10:00:00Z'),
    record('same-time', '2026-11-11T12:00:00+02:00'), record('older', '2026-11-10T23:00:00Z')];
  const source = { ...index, recipes: [{ ...record('legacy'), kind: 'recipe', added: '2026-11-11 09:00' }] };
  assert.deepEqual(recipeCatalog(source, records).recent, ['newest', 'same-time', 'legacy', 'older']);
});

test('integrated recipes do not consume the twelve recent slots', () => {
  const records = [record('sous-vide-salmon', '2026-11-12T00:00:00Z'),
    ...Array.from({ length: 14 }, (_, n) => record(`recipe-${n}`, '2026-11-11T00:00:00Z'))];
  const result = recipeCatalog(index, records);
  assert.equal(result.recent.length, 12);
  assert.equal(result.recent[0], 'recipe-0');
});

test('keeps reference pages and group notes, removes vanished recipe entries', () => {
  const reference = { ...record('reference'), kind: 'reference', group: 'guide', group_id: 'guide' };
  const source = { ...index, recipes: [reference, { ...reference, kind: 'recipe', slug: 'removed' }],
    groups: [{ id: 'guide', name: 'guide', items: ['removed'], notes: [{ title_html: 'Note', html: 'Text' }] }] };
  const result = recipeCatalog(source, []);
  assert.deepEqual(result.recipes, [reference]);
  assert.deepEqual(result.groups[0].items, ['reference']);
  assert.equal(result.groups[0].notes[0].title_html, 'Note');
});

test('rejects malformed publication dates instead of silently dropping a recipe', () => {
  assert.throws(() => recipeCatalog(index, [record('broken', 'tomorrow-ish')]), /publication date/);
});

for (const lang of ['en', 'ru']) {
  test(`${lang}: real recipe files produce all three new recent entries even with an empty export recent list`, () => {
    const source = JSON.parse(fs.readFileSync(`content/${lang}/index.json`, 'utf8'));
    const records = fs.readdirSync(`content/${lang}/recipes`).filter(file => file.endsWith('.json'))
      .map(file => JSON.parse(fs.readFileSync(`content/${lang}/recipes/${file}`, 'utf8')));
    const result = recipeCatalog({ ...source, recent: [] }, records);
    for (const slug of ['crispy-potato-wedges', 'potato-wedge-tempura', 'mooken-mini-cream-puffs']) {
      assert.ok(result.recent.includes(slug), `${slug} must be recently added`);
      assert.ok(result.recipes.find(recipe => recipe.slug === slug)?.added);
    }
  });
}
