import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stepConditions } from '../../src/lib/food/step-conditions.mjs';

const temp = (n, end = '') => `<span class="q" data-k="temp" data-u="C" data-a="${n}"${end ? ` data-b="${end}"` : ''} data-s="0">${n}${end ? `–${end}` : ''} °C</span>`;
const heat = html => ({ label: html, label_html: html, off: false });

test('a heat-only step gets a table row even without ingredient rows or numeric temperatures', () => {
  assert.deepEqual(stepConditions({ heat: heat('medium-low'), body_html: '<p>Stir.</p>' }),
    [{ kind: 'heat', html: 'medium-low' }]);
  assert.deepEqual(stepConditions({ heat: heat('heat off'), body_html: '<p>Rest.</p>' }),
    [{ kind: 'heat', html: 'heat off' }]);
  assert.deepEqual(stepConditions({ heat: null, body_html: '<p>Slice.</p>' }), []);
});

test('prose-only temperatures keep their context and exact live quantity markup', () => {
  const mass = '<span class="q" data-k="mass" data-u="g" data-a="250">250 g</span>';
  const result = stepConditions({ heat: null,
    body_html: `<p>Prepare a bowl. Heat <b>${mass}</b> milk to ${temp('82.5')}.<br>Keep stirring.</p>` });
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'temperature');
  assert.equal(result[0].html, `<span class="step-condition-detail">Heat ${mass} milk to ${temp('82.5')}.</span>`);
});

test('oil, core temperatures, ranges, and fan-oven alternatives remain distinct', () => {
  const result = stepConditions({ heat: heat(`${temp('180')} oil`), body_html:
    `<p>Fry at ${temp('180')}. Check the centre reaches ${temp('63')}. For a fan oven use ${temp('160', '170')}.</p>` });
  assert.equal(result.length, 2);
  assert.ok(!result[1].html.includes('Fry at'));
  assert.ok(result[1].html.includes(`centre reaches ${temp('63')}`));
  assert.ok(result[1].html.includes(`fan oven use ${temp('160', '170')}`));
});

test('Russian prose retains cooling direction and thresholds', () => {
  const result = stepConditions({ heat: heat('слабый нагрев'), body_html:
    `<p>Перемешайте. Остудите ниже ${temp('55')}. Затем добавьте яйца.</p>` });
  assert.equal(result[1].html, `<span class="step-condition-detail">Остудите ниже ${temp('55')}.</span>`);
});

test('every authored step temperature is represented in table conditions in both languages', () => {
  let steps = 0, temperatures = 0;
  const spans = html => html.match(/<span\b(?=[^>]*data-k="temp")[^>]*>[\s\S]*?<\/span>/g) ?? [];
  const key = html => ['u', 'a', 'b'].map(k => html.match(new RegExp(`data-${k}="([^"]*)"`))?.[1] ?? '').join('/');
  for (const lang of ['en', 'ru']) {
    const directory = `content/${lang}/recipes`;
    const records = fs.readdirSync(directory).filter(file => file.endsWith('.json'))
      .map(file => JSON.parse(fs.readFileSync(`${directory}/${file}`, 'utf8')));
    records.push(...JSON.parse(fs.readFileSync(`content/${lang}/sashimi.json`, 'utf8')));
    for (const recipe of records) for (const step of recipe.steps) {
      const html = stepConditions(step).map(row => row.html).join('');
      const represented = new Set(spans(html).map(key));
      for (const span of spans((step.heat?.label_html ?? '') + step.body_html)) {
        assert.ok(represented.has(key(span)), `${lang}/${recipe.slug}/${step.n}: ${span}`);
        temperatures++;
      }
      if (step.heat) assert.ok(html.includes(step.heat.label_html));
      assert.ok(!/[\uE000\uE001]/.test(html), 'no internal quantity placeholders reach the page');
      steps++;
    }
  }
  assert.ok(steps > 1000);
  assert.ok(temperatures > 100);
});
