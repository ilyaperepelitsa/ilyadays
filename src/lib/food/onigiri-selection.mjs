import { ONIGIRI_FILLINGS, FIXED_ONIGIRI_FORMATS, onigiriSelection } from './integrated-recipes.mjs';
import { composeOnigiri } from './onigiri-builder.mjs';
const list=xs=>`<ul class="do">${xs.map(x=>`<li>${x}</li>`).join('')}</ul>`;
const fixedAmount=(n,kind,unit,label)=>`<span class="q" data-k="${kind}" data-u="${unit}" data-a="${n}" data-s="0">${label}</span>`;
const isNori=name=>/\bnori\b|нори/i.test(name);
const labels={
 'yaki-onigiri':['Grilled · yaki','Жареные · яки'], 'nikumaki-onigiri':['Pork-wrapped · nikumaki','В свинине · никумаки'],
 'shrimp-karaage-onigiri':['Crisp shrimp & spicy mayo','Хрустящая креветка и острый майонез'], 'salmon-onigiri':['Salmon & ikura','Лосось и икра'],
 'baby-octopus-onigiri':['Caramelized baby octopus','Карамелизованные осьминоги'], 'onigirazu':['Ginger-pork rice sandwich','Рисовый сэндвич со свининой'], 'spam-musubi':['Spam musubi','Спам-мусуби']
};
export const onigiriLabel=(r,lang)=>labels[r.slug]?.[lang==='ru'?1:0]??r.ingredients[0].name.replace(/\s+\((?:after|по мотивам)\s[^)]*\)$/,'');

function shapeSpecial(r,method,lang) {
 const ru=lang==='ru',t=(en,ruText)=>ru?ruText:en;
 const hand=method.slug==='onigiri',mold=method.slug==='onigiri-mold';
 const indices={'yaki-onigiri':[2,3],'shrimp-karaage-onigiri':[7,10],'salmon-onigiri':[6,7],'baby-octopus-onigiri':[9,10]};
 const [start,end]=indices[r.slug];
 const mass=(n)=>fixedAmount(n,'mass','g',`${n} ${ru?'г':'g'}`);
 const tsp=(n,label)=>fixedAmount(n,'vol','tsp',`${label} ${ru?'ч. л.':'tsp'}`);
 const portion={
  'yaki-onigiri':t('Divide the seasoned rice into nine equal portions. Shape fairly firmly so it survives grilling.','Разделите приправленный рис на девять равных порций. Формуйте достаточно плотно, чтобы рис не развалился при жарке.'),
  'shrimp-karaage-onigiri':t(`For each onigiri use about ${mass(55)} warm rice. Make a well, add one curled fried shrimp and ${tsp(.5,'½')} spicy mayo, then close rice over it.`, `На каждый онигири возьмите около ${mass(55)} тёплого риса. Сделайте углубление, добавьте одну жареную креветку и ${tsp(.5,'½')} острого майонеза, затем закройте рисом.`),
  'salmon-onigiri':t(`Use about ${mass(100)} of the prepared salmon rice per onigiri. Make a small well and add ${tsp(1,'1')} cold ikura in the centre, then gently close the rice without crushing the roe.`, `На каждый онигири возьмите около ${mass(100)} подготовленного риса с лососем. Сделайте углубление, добавьте ${tsp(1,'1')} холодной икры в центр и осторожно закройте, не раздавливая икринки.`),
  'baby-octopus-onigiri':t('Use one of the six equal portions of rice with caramelized octopus already folded through. There is no separate filling pocket.','Возьмите одну из шести равных порций риса с уже вмешанными карамелизованными осьминогами. Отдельного кармана для начинки нет.')
 }[r.slug];
 const prep=hand?t('Wet and lightly salt both hands. Keep rice warm enough to stick.','Смочите и слегка посолите обе ладони. Рис должен быть тёплым и хорошо склеиваться.'):
  mold?t('Wet the mold and lid, shake off excess water and lightly salt inside. Choose a mold large enough for this recipe’s portion and filling.','Смочите форму и крышку, стряхните лишнюю воду и слегка посолите внутри. Размер формы должен вмещать порцию и начинку этого рецепта.'):
  t('Line a small bowl with food-safe cling film and lightly salt it. Leave enough overhang to gather above the rice.','Выстелите маленькую миску пищевой плёнкой и слегка посолите. Оставьте края, чтобы собрать плёнку над рисом.');
 const location=hand?t('Load the portion in your cupped palm.','Выкладывайте порцию на ладонь, сложенную чашечкой.'):
  mold?t('Load the portion into the mold; for a central filling add rice below and above it. For mixed rice load the whole portion directly.','Выкладывайте порцию в форму; под центральной начинкой и над ней должен быть рис. Смешанный рис выкладывайте сразу целой порцией.'):
  t('Load the portion on the film in the bowl; for a central filling close rice around it before gathering the film.','Выкладывайте порцию на плёнку в миске; центральную начинку закройте рисом перед сборкой плёнки.');
 if(hand) {
  const original=r.steps.slice(start,end).filter(s=>!/^Wrap|Оберните/.test(s.title));
  // Preserve the recipe-specific loading pictures and original shaping actions.
  const shape=original.map(s=>({...s,body_html:s.body_html.replace(/<li>Wrap a nori strip[\s\S]*?<\/li>|<li>Оберните полоской нори[\s\S]*?<\/li>/g,'')}));
  if(r.slug==='baby-octopus-onigiri') shape[0]={...shape[0],body_html:list([prep,portion,t('Cup underneath with the left hand; bend the right hand into a roof, press lightly and turn to form three corners.','Поддерживайте снизу левой рукой; правую согните крышей, мягко прижмите и поворачивайте, формируя три угла.')])};
  return [...r.steps.slice(0,start),...shape,...r.steps.slice(end)];
 }
 const load={...method.steps[1],title:t('Portion and load the selected rice','Разделите и выложите выбранный рис'),body_html:list([prep,portion,location]),uses_rows:r.steps.slice(start,end).flatMap(s=>s.uses_rows).filter(u=>!isNori(u.name_html)),images:{...method.steps[1].images,how:method.steps[1].images.how.slice(0,1),result:null}};
 const press={...method.steps[2],body_html:method.steps[2].body_html+(r.slug==='yaki-onigiri'?list([t('Remove every piece of cling film before the rice touches the hot pan or grill.','Полностью уберите плёнку, прежде чем класть рис на горячую сковороду или гриль.')]):'')};
 return [...r.steps.slice(0,start),load,press,...r.steps.slice(end)];
}

/** Keep complete special recipes; only substitute their declared shaping stage. */
export function composeOnigiriSelection(base,r,method,wrap,lang='en') {
 const choice=onigiriSelection(r.slug,method.slug,wrap?.id);
 const ru=lang==='ru',t=(en,ruText)=>ru?ruText:en;
 if(FIXED_ONIGIRI_FORMATS.includes(r.slug)) return {...r,slug:`onigiri-${r.slug}`,siblings:[],prev:null,next:null};
 const shop=ONIGIRI_FILLINGS.includes(r.slug);
 let selected=shop?composeOnigiri(base,r,method,lang):{...r,steps:shapeSpecial(r,method,lang),timeline:null,parts:[],siblings:[],prev:null,next:null};
 let steps=selected.steps.map(s=>({...s}));
 const serving=t('Serve freshly made. For later, cool promptly and refrigerate ideally within one hour; use within 24 hours. Add crisp nori just before eating.','Подавайте свежими. На потом быстро охладите и уберите в холодильник, желательно за час; используйте за 24 часа. Для хруста нори добавляйте перед едой.');
 const serve=choice.wrapping==='none'?serving.replace(' Add crisp nori just before eating.','').replace(' Для хруста нори добавляйте перед едой.',''):serving;
 if(shop) steps[steps.length-1]={...steps.at(-1),title:t('Serve and see the filling','Подача и начинка в разрезе'),body_html:list([serve]),uses_rows:steps.at(-1).uses_rows.filter(u=>!isNori(u.name_html))};
 if(r.slug==='shrimp-karaage-onigiri') {steps=steps.filter(s=>s.n!==11);steps[steps.length-1]={...steps.at(-1),body_html:list([serve])};}
 const noriGroups=selected.ingredients.map(g=>({...g,items:g.items.filter(i=>!isNori(i.name_html))})).filter(g=>g.items.length);
 const count=r.yields.match(/(\d+)(?:[–-](\d+))?/);const a=Number(count?.[1]??4),b=Number(count?.[2]??a);
 let amount=null;
 if(choice.wrapping!=='none') {
  const per=choice.wrapping==='full'?.5:1/3;
  amount=`<span class="q" data-k="count" data-a="${a*per}"${a!==b?` data-b="${b*per}"`:''}>${Number((a*per).toFixed(2))}${a!==b?'–'+Number((b*per).toFixed(2)):''}</span> ${t('sheets; trim to fit','листа; подрежьте по размеру')}`;
  noriGroups.push({name:t('Selected wrapping','Выбранная обёртка'),items:[{name_html:t('Nori','Нори'),amount_html:amount}]});
 }
 const wrappingStep={n:0,id:'',title:wrap.title,part:t('Wrap & serve','Обёртка и подача'),part_id:'wrap',heat:null,time:null,time_html:null,body_html:wrap.body_html,uses_rows:amount?[{name_html:t('Nori','Нори'),amount_html:amount}]:[],images:{photo:null,how:[],result:null,illustration:wrap.image,svg_fallback:null,diagram:null,alt:wrap.title,zoomable:true}};
 steps=steps.map(s=>({...s,uses_rows:s.uses_rows.filter(u=>!isNori(u.name_html))}));
 const insert=shop||r.slug==='shrimp-karaage-onigiri'?steps.length-1:steps.length;
 steps.splice(insert,0,wrappingStep);
 return {...selected,slug:`onigiri-${r.slug}`,ingredients:noriGroups,mise:selected.mise.filter(m=>!isNori(m.name)),steps:steps.map((s,i)=>({...s,n:i+1,id:`step-${i+1}`})),equipment_html:[...new Set([...selected.equipment_html,...(method.slug==='onigiri'?[]:method.equipment_html)])],timeline:null,parts:[],siblings:[],prev:null,next:null};
}
