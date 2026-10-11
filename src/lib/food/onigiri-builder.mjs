import { ONIGIRI_FILLINGS, ONIGIRI_METHODS } from './integrated-recipes.mjs';

const items=html=>Array.from(html.matchAll(/<li>([\s\S]*?)<\/li>/g),m=>m[1]);
const list=paragraphs=>`<ul class="do">${paragraphs.map(p=>`<li>${p}</li>`).join('')}</ul>`;
// Rice cooking is a fixed reference batch, independent of the filling portions control.
const fixed=html=>html.replace(/<span class="q"([^>]*)>/g,(_,attrs)=>`<span class="q"${attrs.replace(/ data-s="[^"]*"/g,'')} data-s="0">`);

/** Compose source recipes without changing a filling's preparation or ingredient quantities. */
export function composeOnigiri(base, filling, method, lang='en') {
  if (!ONIGIRI_FILLINGS.includes(filling.slug) || !['onigiri',...ONIGIRI_METHODS].includes(method.slug)) throw new Error('Unknown onigiri selection');
  const ru=lang==='ru',t=(en,r)=>ru?r:en;
  const hand=method.slug==='onigiri',mold=method.slug==='onigiri-mold';
  const mixed=['eggplant-tsukudani-onigiri','pepperoncino-onigiri'].includes(filling.slug);
  const portion=items(filling.steps[1].body_html);
  const rice=items(base.steps[0].body_html);
  if (portion.length!==3 || rice.length!==4) throw new Error('Onigiri source structure changed');
  const steps=[
    {...filling.steps[0],part:t('Prepare the filling','Приготовьте начинку')},
    {...base.steps[0],part:t('Cook the rice','Сварите рис'),body_html:list([
      t('If you already have warm cooked rice, skip this step. The quantities below make a fixed batch; use the cooked-rice amount in your selected filling’s ingredients.',
        'Если тёплый варёный рис уже готов, пропустите этот шаг. Ниже указана отдельная фиксированная порция для варки; для выбранной начинки возьмите количество готового риса из списка ингредиентов.'),
      ...rice.slice(0,2),
      t('This batch makes about 990 g cooked rice. Keep it plain, without vinegar or sugar; keep it covered and cool only until comfortable to handle.',
        'Получится около 990 г варёного риса. Не добавляйте уксус или сахар; держите рис накрытым и остудите лишь настолько, чтобы его можно было держать в руках.'),
    ]),uses_rows:base.ingredients[0].items.slice(0,2).map(i=>({...i,amount_html:fixed(i.amount_html)}))},
  ];
  const part=t('Shape by hand','Слепите руками');
  if (hand) {
    steps.push({...base.steps[1],part});
    steps.push({...filling.steps[1],part,title:mixed?t('Mix and portion the rice','Смешайте и разделите рис'):t('Add your selected filling','Добавьте выбранную начинку'),
      body_html:list([portion[1]]),images:{...filling.steps[1].images,result:null}});
    steps.push({...base.steps[3],part,images:{...base.steps[3].images,result:filling.steps[1].images.result}});
  } else {
    const part=mold?t('Shape with a mold','Сформуйте в форме'):t('Shape through wrap','Сформуйте через плёнку');
    const source=method.steps[1],prep=items(source.body_html)[1];
    const loading=portion[1].replace('in your palm',mold?'in the mold':'on the plastic wrap in the bowl')
      .replace('на ладонь',mold?'в форму':'на плёнку в миске');
    const capacity=mold?t('Use a mold that holds about 120 g rice plus your filling. A whole yolk must fit without crushing; choose hand or wrap shaping if your mold is too small.',
      'Возьмите форму, вмещающую около 120 г риса вместе с начинкой. Целый желток должен помещаться без сдавливания; если форма мала, лепите руками или через плёнку.'):null;
    const mixedLoad=mixed?(mold?t('Fill the wet, salted mold with one portion of mixed rice, gently pushing it into the corners. Do not add a separate filling.',
      'Заполните влажную подсоленную форму одной порцией смешанного риса, мягко распределяя его по углам. Отдельную начинку не добавляйте.'):
      t('Put one portion of mixed rice on the wrap in the bowl. Do not make a well or add a separate filling.',
        'Выложите одну порцию смешанного риса на плёнку в миске. Не делайте углубление и не добавляйте отдельную начинку.')):null;
    steps.push({...source,part,body_html:list([prep,...(capacity?[capacity]:[]),loading,...(mixedLoad?[mixedLoad]:[])]),
      uses_rows:filling.steps[1].uses_rows,images:mixed&&mold?{...source.images,how:source.images.how.slice(0,1),result:null}:source.images});
    steps.push({...method.steps[2],part});
  }
  steps.push({...filling.steps[2],part:t('Finish & serve','Подача')});
  const notes=[...filling.notes,...base.notes].filter((n,i,all)=>all.findIndex(x=>x.title_html===n.title_html)===i);
  return {...filling,slug:`onigiri-${filling.slug}`,steps:steps.map((s,i)=>({...s,n:i+1,id:`step-${i+1}`,part_id:`onigiri-stage-${i+1}`})),
    equipment_html:[...new Set([...filling.equipment_html,...method.equipment_html])],notes,
    sources:[...filling.sources,...base.sources].filter((s,i,all)=>all.findIndex(x=>x.url===s.url)===i),timeline:null,parts:[],siblings:[]};
}
