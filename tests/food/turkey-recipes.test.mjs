import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const trip = read('content/travel/turkey-yacht-food.json');
const slugs = trip.cards.map(card => card.recipe_slug);

for (const lang of ['en', 'ru']) {
  test(`${lang}: all twelve Turkey ideas are complete Food recipes with useful preparation art`, () => {
    assert.equal(new Set(slugs).size, 12);
    const index = read(`content/${lang}/index.json`);
    const group = index.groups.find(group => group.items.includes('yacht-sashimi'));
    assert.equal(group.items.length, 12);
    for (const slug of slugs) {
      const r = read(`content/${lang}/recipes/${slug}.json`);
      assert.ok(r.before_ingredients_html.includes(lang === 'ru' ? 'Упрощённая версия' : 'Simplified version'), slug);
      assert.equal(r.ingredients.length, 2, `${slug}: core and optional lists`);
      assert.equal(r.ingredients[1].name, lang === 'ru' ? 'Необязательные добавки' : 'Optional additions');
      assert.match(r.intro_html, /turkey-yacht-food#shopping/);
      assert.ok(r.sources.length > 0, `${slug}: attributed references`);
      assert.ok(r.steps.length >= 4, `${slug}: full instructions`);
      assert.equal(r.mise.length, 3, `${slug}: prepared ingredient previews`);
      for (const preview of r.mise) {
        assert.ok(preview.image, `${slug}/${preview.name}: preview picture`);
        assert.equal(preview.svg_fallback, null);
      }
      const images = r.steps.map(step => step.images.illustration);
      assert.equal(new Set(images).size, images.length, `${slug}: different preparation stages`);
      for (const step of r.steps) {
        assert.ok(step.uses_rows.length, `${slug}/${step.n}: measured step ingredients`);
        assert.ok(step.body_html.length > 150, `${slug}/${step.n}: usable instructions`);
        assert.equal(step.images.svg_fallback, null);
        assert.ok(!step.images.diagram, `${slug}/${step.n}: no diagram`);
        assert.equal(step.images.zoomable, true);
        assert.ok(step.images.illustration, `${slug}/${step.n}: generated picture`);
        assert.ok(fs.existsSync(path.join(root, 'public/media', step.images.illustration.split('?')[0])));
      }
      assert.ok(!/\b(bulgur|chickpeas?|lentils?|beans?)\b/i.test(JSON.stringify(r.ingredients)), `${slug}: menu exclusions`);
    }
  });
}

test('one sashimi recipe contains all nine actionable species variations', () => {
  assert.equal(slugs.filter(slug => /sashimi/.test(slug)).length, 1);
  assert.equal(trip.sashimi.length, 9);
  for (const row of trip.sashimi) {
    for (const lang of ['en', 'ru']) {
      assert.ok(row.preparation[lang].length > 120);
      assert.match(row.preparation[lang], /300/);
    }
  }
  const r = read('content/en/recipes/yacht-sashimi.json');
  const prose = r.steps.map(step => step.body_html).join(' ');
  assert.match(prose, /documentation/);
  assert.match(prose, /cold chain/);
  assert.match(prose, /vacuum/);
  assert.match(prose, /Reject/);
});

test('sashimi has nine complete illustrated, scalable selections in both languages', () => {
  for (const lang of ['en','ru']) {
    const variants=read(`content/${lang}/sashimi.json`);
    assert.equal(variants.length,9);
    assert.equal(new Set(variants.map(r=>r.hero.image)).size,9);
    assert.equal(new Set(variants.map(r=>r.mise[0].image)).size,9);
    for (const r of variants) {
      assert.equal(r.scale.serves,2);
      assert.match(r.ingredients[0].items[0].amount_html,/data-a="300"/);
      assert.ok(r.mise.every(m=>m.image&&!m.svg_fallback));
      assert.ok(r.steps.every(s=>s.uses_rows.length));
      assert.ok(r.steps[2].images.illustration||r.steps[2].images.how.length);
      assert.ok(r.steps.every(s=>!s.images.diagram&&!s.images.svg_fallback));
    }
    const tuna=variants.find(r=>r.slug==='sashimi-tuna');
    assert.equal(tuna.steps[2].images.how.length,2);
    assert.match(tuna.steps[2].body_html,/90/);
    const shrimp=variants.find(r=>r.slug==='sashimi-shrimp');
    assert.match(shrimp.steps[2].body_html,lang==='en'?/No cutting/:/Нарезка не нужна/);
  }
});

test('split cooking fats retain their exact per-step amounts', () => {
  for(const lang of ['en','ru']) {
    const shrimp=read(`content/${lang}/recipes/garlic-chilli-shrimp.json`);
    for(const step of shrimp.steps.slice(1,3)) assert.ok(step.uses_rows.some(row=>row.amount_html.includes('data-a="12.5"')));
    const beef=read(`content/${lang}/recipes/cokertme.json`);
    assert.ok(beef.steps[1].uses_rows.some(row=>row.amount_html.includes('data-a="3"')));
    assert.ok(beef.steps[3].uses_rows.some(row=>row.amount_html.includes('data-a="1"')));
  }
});

test('the approved image style is preserved verbatim, with a real style reference', () => {
  const policy=read('art/image-requirements.json');
  assert.equal(policy.style,read('art/nigiri/illustration-prompts.json').style);
  const prompts=read('art/recipe-quality/prompts.json');
  for(const row of prompts) {
    assert.ok(row.prompt.includes(policy.style));
    assert.ok(row.reference_paths.length);
    assert.ok(row.reference_paths[0].endsWith(policy.style_reference));
    assert.ok(fs.existsSync(path.join(root,policy.style_reference)));
  }
});

test('image prompts carry the centralized policy and distinct action scenes', () => {
  const policy = read('art/image-requirements.json');
  assert.match(policy.style, /Miyazaki/);
  assert.match(policy.anatomy, /five digits/);
  assert.match(policy.small_pieces, /fractal/);
  const prompts = read('art/turkey-recipes/prompts.json');
  assert.equal(prompts.length, 50);
  for (const row of prompts) {
    assert.ok(row.prompt.includes(policy.small_pieces), `${row.slug}/${row.key}`);
    assert.match(row.prompt, /no photorealism/i);
  }
});
