"""Nine complete selectable preparations; exported together, never separate route cards."""
import json
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
from kit import Bowl
from turkish_recipes import RECIPES, TRANSLATIONS, amount_ru
DATA=json.loads(Path(__file__).with_name('sashimi_variants.json').read_text())
BASE=next(r for r in RECIPES if r.slug=='yacht-sashimi')
VARIANTS=[]
for v in DATA:
 tr=dict(TRANSLATIONS[BASE.slug])
 tr.update({'Drinking water':'Питьевая вода','Just One Cookbook — slicing sashimi':'Just One Cookbook — нарезка сашими','Modernist Cuisine — muscle grain':'Modernist Cuisine — мышечные волокна',
 'Find the fine grain in the red flesh; here it runs left–right.':'Найдите тонкие линии волокон в красной мякоти; здесь они идут слева направо.',
 'Cut front–back, across the fine grain at roughly 90°, into 5–7 mm slices.':'Режьте от дальней стороны к ближней поперёк тонких линий примерно под 90°, ломтиками 5–7 мм.'})
 def t(pair):
  tr[pair[0]]=pair[1]
  return pair[0]
 protein=t(v['protein'])
 core=[(protein,t(('300 g','300 г'))),('Soy sauce','1 tbsp'),(t(v['citrus']),'2 tsp'),('Drinking water','2 tsp')]
 # Inherit the existing exact ingredient translations; translate newly selected additions.
 optional=[(t((en,ru)),t((a,amount_ru(a)))) for en,ru,a in v['optional']]
 steps=deepcopy(BASE.steps)
 steps[0].uses=[protein]
 steps[1].uses=[x[0] for x in core[1:]]
 steps[1].body=t(('Stir the soy sauce, citrus juice and drinking water in a small cup; keep it separate until eating. Wash your hands and prepare a clean board, a sharp long knife and a chilled plate. Prepare any optional garnish before handling seafood. Keep the seafood refrigerated while you do this.', 'Смешайте соевый соус, сок цитруса и питьевую воду в чашке; держите отдельно до еды. Вымойте руки, подготовьте чистую доску, острый длинный нож и охлаждённую тарелку. Необязательные добавки подготовьте до работы с морепродуктами. Всё это время держите морепродукты в холодильнике.'))
 steps[2].title=t(v['title']);steps[2].body=t(v['body']);steps[2].uses=[protein]
 # The tuna technique uses two sequential pictures rather than the single-picture marker.
 if v['id']=='tuna':steps[2].diagram=None
 steps[3].body=t(('Arrange one small portion at a time on chilled plates. Keep the dip separate and add only the optional ingredients listed for this selection at the table. Eat immediately, leaving the remaining seafood refrigerated. Lemon, soy and a quick sear do not replace raw-use controls. Reject seafood after a failed cold chain; cooking does not rescue it.', 'Раскладывайте небольшие порции на охлаждённые тарелки. Соус подавайте отдельно; за столом добавляйте только необязательные ингредиенты выбранного варианта. Ешьте сразу, оставляя остальное в холодильнике. Лимон, соя и быстрая обжарка не заменяют контроль сырой подачи. Продукт с нарушенной холодовой цепью выбрасывайте; приготовление его не спасёт.'))
 steps[3].uses=[protein]+[x[0] for x in optional]
 # Every species has its own ingredient state and cutting/handling image.
 mise=[Bowl(t(v['protein']),t(('300 g · prepared for raw consumption · keep chilled','300 г · подготовлено для сырой подачи · держите в холоде')),[],t(('Steps 1 & 3','Шаги 1 и 3'))),
       Bowl(t(('Citrus–soy dip','Цитрусово-соевый соус')),t(('Soy 1 tbsp · citrus 2 tsp · water 2 tsp','Соя 1 ст. л. · цитрус 2 ч. л. · вода 2 ч. л.')),[],t(('Step 2','Шаг 2')),vessel='cup')]
 label=v['label'];title=t((label['en']+' sashimi',label['ru']+' — сашими'))
 sourcing=t((v['sourcing']['en'],v['sourcing']['ru']))
 intro=t(('A complete preparation for the selected seafood. Buy an explicitly documented raw-use product, keep at 0–4 °C and prepare on purchase day.','Полная подготовка выбранного морепродукта. Покупайте продукт с документами для сырой подачи, храните при 0–4 °C и готовьте в день покупки.'))+' '+sourcing
 tr[intro]=tr[intro.split(' '+sourcing)[0]]+' '+tr[sourcing]
 simple=t(('Buy the selected seafood already trimmed by a raw-use specialist. Make the core dip and skip all optional additions. Supplier checks and cold storage still apply.','Купите выбранный морепродукт уже зачищенным у специалиста по сырой подаче. Сделайте основной соус и пропустите необязательные добавки. Проверка поставки и холодное хранение обязательны.'))
 sh=f'<div class="note"><h3>Simplified version</h3><p>{simple}</p></div>'
 tr[sh]=f'<div class="note"><h3>Упрощённая версия</h3><p>{tr[simple]}</p></div>'
 r=replace(BASE,slug='sashimi-'+v['id'],title=title,intro=intro,ingredients=[('Core ingredients',core),('Optional additions',optional)],mise=mise,steps=steps,before_ingredients=sh,
  sources=BASE.sources+[('Just One Cookbook — slicing sashimi','https://www.justonecookbook.com/how-to-slice-and-plate-sashimi/'),('Modernist Cuisine — muscle grain','https://modernistcuisine.com/mc/understanding-meat/')])
 VARIANTS.append(r);TRANSLATIONS[r.slug]=tr
if __name__=='__main__':
 for slug,tr in TRANSLATIONS.items():
  (Path(__file__).parent/'i18n'/'ru'/f'{slug}.json').write_text(json.dumps(tr,ensure_ascii=False,indent=2)+'\n')
 print('Updated Turkish + sashimi translations')
