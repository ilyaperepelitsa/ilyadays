import assert from 'node:assert/strict';
import { it } from 'node:test';
import { formatRecipeText } from '../../src/lib/food/recipe-text.mjs';

it('formats a complete recipe as a readable plain-text post with distinct steps and source attribution',()=>{
 const output=formatRecipeText({title:'Caramelized octopus onigiri',metadata:['Original yield: 6 onigiri','Ingredient amounts for 2 people'],ingredients:[{title:'INGREDIENTS\n\nPlain rice',items:['Rice — 225 g','Water — 300 ml']},{title:'Glaze',items:['Soy sauce — 1½ tbsp']}],equipment:['EQUIPMENT','Pan'],steps:[{title:'Cook the rice',meta:'25 min',body:'- Cook separately.\n- Keep covered.'},{title:'Fold in octopus',body:'- Add only drained coated pieces.'}],notes:[{title:'Storage',body:'Chill promptly.'}],sources:['MAFF: https://www.maff.go.jp/']});
 assert.match(output,/Plain rice\n\n- Rice — 225 g\n- Water — 300 ml\n\nGlaze/);
 assert.match(output,/1\. Cook the rice \(25 min\)\n\n- Cook separately/);
 assert.match(output,/\n\n2\. Fold in octopus\n\n/);
 assert.ok(output.endsWith('MAFF: https://www.maff.go.jp/\n'));
 assert.doesNotMatch(output,/<[^>]+>|undefined|\[object Object\]/);
});

it('omits empty sections and supports Russian and selected calculator results',()=>{
 assert.equal(formatRecipeText({title:'Лосось',notes:[{title:'ВЫБРАННЫЙ РЕЖИМ',body:'25 мм\n50 °C\n30 минут'}]}),'Лосось\n\nВЫБРАННЫЙ РЕЖИМ\n\n25 мм\n50 °C\n30 минут\n');
});
