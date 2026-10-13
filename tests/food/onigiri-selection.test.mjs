import assert from 'node:assert/strict';
import fs from 'node:fs';
import { it } from 'node:test';
import { composeOnigiriSelection } from '../../src/lib/food/onigiri-selection.mjs';
import { ONIGIRI_RECIPES, ONIGIRI_METHODS, FIXED_ONIGIRI_FORMATS, onigiriSelection } from '../../src/lib/food/integrated-recipes.mjs';
const read=(lang,slug)=>JSON.parse(fs.readFileSync(new URL(`../../content/${lang}/recipes/${slug}.json`,import.meta.url)));
const wraps=lang=>JSON.parse(fs.readFileSync(new URL(`../../content/${lang}/onigiri-wrapping.json`,import.meta.url)));
const plain=s=>s.replace(/<[^>]*>/g,'');

it('composes all sixteen complete recipes with every shape and wrapping in EN/RU without mutating sources',()=>{
 assert.equal(ONIGIRI_RECIPES.length,16);
 for(const lang of ['en','ru'])for(const slug of ONIGIRI_RECIPES)for(const method of ['onigiri',...ONIGIRI_METHODS])for(const wrap of wraps(lang)){
  const input=[read(lang,'onigiri'),read(lang,slug),read(lang,method),wrap];
  const before=JSON.stringify(input),r=composeOnigiriSelection(...input,lang);
  assert.equal(JSON.stringify(input),before);
  assert.equal(r.hero.image,input[1].hero.image);
  assert.equal(r.yields,input[1].yields);
  assert.ok(r.steps.length>=5);
  assert.equal(new Set(r.steps.map(s=>s.id)).size,r.steps.length);
  for(const step of r.steps){
   assert.ok(!step.images.diagram&&!step.images.svg_fallback&&!step.images.photo);
   for(const src of [step.images.illustration,step.images.result,...step.images.how.map(x=>x.src)].filter(Boolean))
    assert.ok(fs.existsSync(new URL('../../public/media/'+src.split('?')[0],import.meta.url)),src);
  }
  if(FIXED_ONIGIRI_FORMATS.includes(slug)){
   assert.deepEqual(r.steps,input[1].steps,'structural recipes retain their complete assembly');
   assert.deepEqual(r.ingredients,input[1].ingredients);
  }else{
   const nori=r.ingredients.flatMap(g=>g.items).filter(i=>/nori|нори/i.test(i.name_html));
   assert.equal(nori.length,wrap.id==='none'?0:1);
   assert.ok(!r.mise.some(m=>/nori|нори/i.test(m.name)),'generic nori preview must not contradict selected wrapping');
   assert.ok(r.steps.some(s=>s.title===wrap.title&&s.images.illustration===wrap.image));
   if(nori.length){
    const pieces=Number(input[1].yields.match(/\d+/)[0]);
    const amount=Number(nori[0].amount_html.match(/data-a="([^"]+)"/)[1]);
    assert.ok(Math.abs(amount-pieces*(wrap.id==='full'?.5:1/3))<1e-8);
   }
  }
 }
});

it('preserves special filling preparation and prevents invalid format combinations',()=>{
 for(const lang of ['en','ru']){
  const compose=(slug,method='onigiri',wrap='strip')=>composeOnigiriSelection(read(lang,'onigiri'),read(lang,slug),read(lang,method),wraps(lang).find(w=>w.id===wrap),lang);
  for(const method of ['onigiri',...ONIGIRI_METHODS]){
   for(const [slug,cooking]of [['yaki-onigiri',2],['shrimp-karaage-onigiri',7],['salmon-onigiri',6],['baby-octopus-onigiri',9]]){
    const original=read(lang,slug),r=compose(slug,method);
    assert.deepEqual(r.steps.slice(0,cooking).map(s=>s.body_html),original.steps.slice(0,cooking).map(s=>s.body_html));
   }
   const salmon=plain(compose('salmon-onigiri',method).steps.map(s=>s.body_html).join(' '));
   assert.match(salmon,lang==='en'?/ikura.*centr?e|ikura.*center/i:/икр.*центр/i);
   const octopus=plain(compose('baby-octopus-onigiri',method).steps.map(s=>s.body_html).join(' '));
   assert.match(octopus,lang==='en'?/six equal portions/:/шест[ьи] равны[ех] порци/);
   assert.doesNotMatch(octopus,/90\s*[gг]|half.*(?:rice cooker)|половин.*рисовар/i);
  }
  const grilled=compose('yaki-onigiri','onigiri-plastic-wrap');
  assert.match(plain(grilled.steps[3].body_html),lang==='en'?/Remove every piece of cling film/:/Полностью уберите плёнку/);
 }
 assert.deepEqual(onigiriSelection('onigirazu','onigiri-mold','none'),{recipe:'onigirazu',method:'recipe',wrapping:'sandwich'});
 assert.deepEqual(onigiriSelection('bad','bad','bad'),{recipe:ONIGIRI_RECIPES[0],method:'onigiri',wrapping:'strip'});
 assert.equal(onigiriSelection('yaki-onigiri').wrapping,'none');
 const noNori=composeOnigiriSelection(read('en','onigiri'),read('en','shrimp-karaage-onigiri'),read('en','onigiri'),wraps('en').find(w=>w.id==='none'));
 assert.doesNotMatch(noNori.steps.at(-1).body_html,/Add crisp nori/);
});
