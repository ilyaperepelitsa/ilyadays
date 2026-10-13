import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { composeOnigiri } from '../../src/lib/food/onigiri-builder.mjs';
import { ONIGIRI_FILLINGS, ONIGIRI_METHODS, ONIGIRI_RECIPES, integratedDestination, consolidatedIndex } from '../../src/lib/food/integrated-recipes.mjs';

const read=(lang,slug)=>JSON.parse(fs.readFileSync(new URL(`../../content/${lang}/recipes/${slug}.json`,import.meta.url)));
const text=html=>html.replace(/<[^>]*>/g,'');
const images=r=>r.steps.flatMap(s=>[s.images.illustration,s.images.result,...s.images.how.map(h=>h.src)]).filter(Boolean);

describe('one-page onigiri recipes',()=>{
  it('preserves every filling preparation, quantity, picture and cutaway for all 27 combinations in both languages',()=>{
    for(const lang of ['en','ru']) for(const slug of ONIGIRI_FILLINGS) for(const methodSlug of ['onigiri',...ONIGIRI_METHODS]) {
      const base=read(lang,'onigiri'),filling=read(lang,slug),method=read(lang,methodSlug);
      const before=JSON.stringify([base,filling,method]);
      const r=composeOnigiri(base,filling,method,lang);
      assert.equal(JSON.stringify([base,filling,method]),before,'composition must not mutate cached source recipes');
      assert.deepEqual(r.ingredients,filling.ingredients);
      assert.equal(r.steps[0].body_html,filling.steps[0].body_html);
      assert.deepEqual(r.steps[0].images,filling.steps[0].images);
      assert.deepEqual(r.steps.at(-1).images,filling.steps.at(-1).images);
      assert.equal(r.hero.image,filling.hero.image);
      assert.equal(r.yields,filling.yields);
      assert.equal(new Set(r.steps.map(s=>s.id)).size,r.steps.length);
      for(const source of filling.sources) assert.ok(r.sources.some(s=>s.url===source.url));
      if(methodSlug==='onigiri') for(const src of images(filling)) assert.ok(images(r).includes(src),`${slug} must retain all six filling pictures`);
      assert.ok(r.steps[1].uses_rows.every(i=>Array.from(i.amount_html.matchAll(/<span class="q"[^>]*>/g)).every(m=>m[0].includes('data-s="0"'))),'fixed rice batch must not scale with filling servings');
      for(const step of r.steps) assert.ok(!step.images.diagram&&!step.images.svg_fallback&&!step.images.photo);
    }
  });

  it('adapts filling placement to the selected method without generic filling amounts',()=>{
    for(const lang of ['en','ru']) for(const slug of ONIGIRI_FILLINGS) for(const methodSlug of ONIGIRI_METHODS) {
      const r=composeOnigiri(read(lang,'onigiri'),read(lang,slug),read(lang,methodSlug),lang);
      const loading=r.steps[2].body_html,plain=text(loading);
      assert.doesNotMatch(plain,/in your palm|на ладонь/);
      assert.doesNotMatch(plain,/1–2 tsp|1–2 ч/,'keep the selected filling’s amount, not the generic method quantity');
      if(['eggplant-tsukudani-onigiri','pepperoncino-onigiri'].includes(slug)) {
        assert.match(plain,lang==='en'?/no separate filling pocket/:/Отдельного кармана/);
        assert.doesNotMatch(plain,/make a well and add|сделайте углубление и добавьте/);
        if(slug==='pepperoncino-onigiri') assert.match(plain,lang==='en'?/do not pour it all/:/не выливайте его всё/);
      } else {
        assert.match(plain,lang==='en'?/60 g/:/60 г/);
        if(slug==='soy-cured-yolk-onigiri') assert.match(plain,lang==='en'?/one drained cured yolk/:/один маринованный желток/);
      }
      if(methodSlug==='onigiri-mold') assert.match(plain,lang==='en'?/must fit without crushing/:/без сдавливания/);
      if(methodSlug==='onigiri-plastic-wrap') assert.match(text(r.steps[3].body_html),lang==='en'?/remove all plastic/:/полностью уберите плёнку/);
    }
  });

  it('consolidates cards and gives every legacy filling, method and salmon recipe a selectable destination',()=>{
    for(const lang of ['en','ru']) {
      const raw=JSON.parse(fs.readFileSync(new URL(`../../content/${lang}/index.json`,import.meta.url)));
      const index=consolidatedIndex(raw);
      for(const slug of [...ONIGIRI_RECIPES,...ONIGIRI_METHODS,'sous-vide-salmon']) {
        assert.ok(!index.recipes.some(r=>r.slug===slug));
        assert.ok(!index.groups.some(g=>g.items.includes(slug)));
        assert.ok(!index.recent.includes(slug));
        assert.ok(integratedDestination(slug).includes('?'));
      }
      assert.ok(index.groups.find(g=>g.id==='onigiri').items.includes('onigiri'));
      assert.equal(index.groups.find(g=>g.id==='onigiri').items.length,1);
    }
    assert.equal(integratedDestination('sous-vide-salmon'),'/sous-vide?food=salmon');
    assert.equal(integratedDestination('soboro-onigiri'),'/onigiri?filling=soboro-onigiri');
    assert.equal(integratedDestination('onigiri-mold'),'/onigiri?method=onigiri-mold');
    assert.equal(integratedDestination('nigiri'),null);
  });
});
