/** A readable, plain-text post: no HTML, pictures or page controls. */
export function formatRecipeText({title, metadata=[], ingredients=[], equipment=[], steps=[], notes=[], sources=[]}) {
 const blocks=[title,metadata.filter(Boolean).join('\n')];
 const group=(heading,items)=>items.length?`${heading}\n\n${items.join('\n')}`:'';
 for(const section of ingredients) blocks.push(group(section.title,section.items.map(x=>`- ${x}`)));
 if(equipment.length) blocks.push(group(equipment[0],equipment.slice(1).map(x=>`- ${x}`)));
 for(const [i,step] of steps.entries()) blocks.push(`${i+1}. ${step.title}${step.meta?` (${step.meta})`:''}\n\n${step.body}`);
 for(const note of notes) blocks.push(`${note.title}\n\n${note.body}`);
 if(sources.length) blocks.push(sources.join('\n'));
 return blocks.filter(Boolean).join('\n\n').trim()+'\n';
}

/** Read the rendered quantities, including portions, units and vinegar substitutions. */
export function recipeTextFromPage(article,{title,yields,total,lang}) {
 const ru=lang==='ru',t=(en,rus)=>ru?rus:en;
 const skip='figure,svg,img,button,input,select,script,style,.step-n,.recipe-text,[hidden]';
 const walk=(node,depth=0)=>{
  if(node.nodeType===3)return node.textContent??'';
  if(node.nodeType!==1)return '';
  if(node.matches(skip)||getComputedStyle(node).display==='none')return '';
  const children=()=>[...node.childNodes].map(x=>walk(x,depth)).join('');
  if(node.tagName==='BR')return '\n';
  if(['UL','OL'].includes(node.tagName))return '\n'+[...node.children].map((x,i)=>`${'  '.repeat(depth)}${node.tagName==='OL'?`${i+1}.`:'-'} ${[...x.childNodes].map(n=>walk(n,depth+1)).join('').trim()}`).join('\n')+'\n';
  if(node.tagName==='TR')return [...node.children].map(x=>walk(x,depth).trim()).join(' | ')+'\n';
  const text=children();
  return /^(P|DIV|H[1-6]|ASIDE|SECTION|BLOCKQUOTE)$/.test(node.tagName)?'\n'+text+'\n':text;
 };
 const text=node=>node?walk(node).replace(/[\t ]+\n/g,'\n').replace(/\n[\t ]*\n(?:[\t ]*\n)+/g,'\n\n').trim():'';
 const all=(root,selector)=>root?[...root.querySelectorAll(selector)]:[];
 const ingredientRoot=article.querySelector('#ingredients');
 const intro=article.querySelector('.sashimi-controls .sv-help')??(!article.classList.contains('onigiri-builder')?article.querySelector('.lede'):null);
 const metadata=[yields?`${t('Original yield','Исходный выход')}: ${yields}`:'',total,text(intro)].filter(Boolean);
 const portions=ingredientRoot?.querySelector('[data-portions]');
 if(portions){
  const number=portions.querySelector('input[data-n]')?.value;
  const perPerson=portions.querySelector('[data-view="one"][aria-pressed="true"]');
  if(number)metadata.push(perPerson?t('Ingredient amounts: per person','Количество ингредиентов: на человека'):portions.dataset.mode==='people'?`${t('Ingredient amounts for','Количество ингредиентов на')} ${number} ${t('people','чел.')}`:`${t('Batches','Порции рецепта')}: ${number}`);
  metadata.push(...all(portions,'[data-note]:not([hidden])').map(text));
 }
 const ingredients=all(ingredientRoot,'ul.ingredients').map(ul=>({title:text(ul.previousElementSibling),items:[...ul.children].filter(li=>!li.hidden).map(li=>`${text(li.querySelector('.ing-name'))} — ${text(li.querySelector('.ing-amt'))}`)}));
 if(ingredients.length)ingredients[0].title=t('INGREDIENTS','ИНГРЕДИЕНТЫ')+'\n\n'+ingredients[0].title;
 const equipment=all(ingredientRoot,'.equipment li').map(text);
 const steps=all(article,'#steps li.step').map(li=>{
  const uses=all(li,'.uses li').map(row=>'- '+[...row.children].map(text).join(' — '));
  return {title:text(li.querySelector('.step-text h3')),meta:all(li,'.chips .chip').map(text).join(' · '),body:[uses.length?text(li.querySelector('.uses h4'))+'\n'+uses.join('\n'):'',text(li.querySelector('.step-body'))].filter(Boolean).join('\n\n')};
 });
 const notes=all(article,'.notes .note').map(n=>({title:text(n.querySelector('h3')),body:text(n.querySelector('h3')?.nextElementSibling)}));
 const sources=all(article,'.sources a, .sv-sources a').map(a=>`${text(a)}: ${a.href}`);
 const batch=article.querySelector('#batch');
 if(batch)notes.unshift({title:text(batch.querySelector('h2')),body:[batch.querySelector('select')?.selectedOptions[0]?.textContent,all(batch,'.batch-out li').map(li=>'- '+[...li.children].map(text).join(' — ')).join('\n'),text(batch.querySelector('.batch-use')),text(batch.querySelector('.batch-store'))].filter(Boolean).join('\n\n')});
 if(!steps.length){
  const planner=article.querySelector('#thickness');
  if(planner){
   const selected=all(planner,'button[aria-pressed="true"]').map(x=>x.textContent.trim());
   selected.push(...all(planner,'.sv-slider').map(x=>`${text(x.querySelector('label'))}: ${text(x.querySelector('output, .sv-fixed-temp'))||x.querySelector('select')?.selectedOptions[0]?.textContent||''}`));
   notes.unshift({title:t('SELECTED COOK','ВЫБРАННЫЙ РЕЖИМ'),body:selected.join('\n')+'\n\n'+text(planner.querySelector('.sv-answer, [role="status"]'))});
   notes.push(...all(planner,'.sv-help, .sv-calculator > p').map(n=>({title:'',body:text(n)})).filter(n=>n.body));
  }
 }
 return formatRecipeText({title,metadata,ingredients,equipment:equipment.length?[t('EQUIPMENT','ОБОРУДОВАНИЕ'),...equipment]:[],steps,notes,sources:sources.length?[t('SOURCES','ИСТОЧНИКИ'),...sources]:[]});
}
