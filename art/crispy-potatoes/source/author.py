"""Author canonical recipe modules and exact-string Russian tables. Run from ilyadays."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CANON = ROOT.parent / 'recipes'
TR = {}

def t(en, ru):
    TR[en] = ru
    return en

def step(title, body, *, heat='', time='', uses=()):
    return dict(title=title, body=body, heat=heat, time=time, uses=list(uses))

P = t('Peeled floury potatoes', 'Очищенный рассыпчатый картофель')
W = t('Water for simmering', 'Вода для варки')
S = t('Salt for simmering', 'Соль для варки')
O = t('Neutral frying oil', 'Нейтральное масло для фритюра')
F = t('Fine salt to finish', 'Мелкая соль для подачи')
G = t('Garlic powder', 'Сушёный молотый чеснок')
R = t('Dried oregano', 'Сушёный орегано')
B = t('Dried basil', 'Сушёный базилик')
PE = t('Black pepper', 'Чёрный перец')
M = t('Mayonnaise to serve', 'Майонез для подачи')
equipment = [t('Deep fryer or tall heavy pot', 'Фритюрница или высокая толстостенная кастрюля'), t('Oil thermometer', 'Термометр для масла'), t('Saucepan and colander', 'Кастрюля и дуршлаг'), t('Wire rack and tray', 'Решётка с поддоном'), t('Mesh spider or slotted spoon', 'Шумовка или сетчатая ложка')]
cut = t('Use Russet, Maris Piper, King Edward or another floury frying potato. Peel and cut lengthwise into <b>6 wedges per medium potato</b>; cut a large one into 8. Aim for <b>15 mm at the thickest part</b>, not a fixed number of pieces. Split any wedge wider than 20 mm. Rinse once.', 'Возьмите Russet, Maris Piper, King Edward или другой рассыпчатый картофель для жарки. Очистите и разрежьте вдоль на <b>6 долек из средней картофелины</b>; крупную — на 8. Ориентир — <b>15 мм в самой толстой части</b>, а не число долек. Дольки шире 20 мм разделите ещё раз. Один раз промойте.')
boil = t('Bring the water and simmering salt to a boil. Add the wedges, return to a <b>gentle simmer</b>, then cook about <b>7–10 minutes</b>. Start checking at 6 minutes: a thin knife should enter the thickest centre easily, while the wedge still lifts intact. Tenderness decides when to drain.', 'Вскипятите воду с солью для варки. Добавьте дольки, снова доведите до <b>слабого кипения</b> и варите примерно <b>7–10 минут</b>. Начните проверять через 6 минут: тонкий нож должен легко входить в толстую середину, но долька должна сохранять форму при подъёме. Сливайте воду по готовности, а не строго по таймеру.')
oil_note = t('Use refined sunflower, rapeseed/canola or peanut oil. In an electric fryer follow its minimum and maximum fill lines. In a pot use about 5 cm depth and fill <b>no more than one third</b>. Fry roughly <b>150–200 g at a time in a 3-litre fryer</b>, less in a small pot; wedges need room. Restore the stated temperature between batches. Surface water must be gone before any potato enters oil.', 'Подойдёт рафинированное подсолнечное, рапсовое или арахисовое масло. Во фритюрнице соблюдайте отметки минимального и максимального уровня. В кастрюле налейте слой около 5 см, заполняя её <b>не более чем на треть</b>. Для фритюрницы на 3 литра ориентируйтесь на <b>150–200 г картофеля за раз</b>, для небольшой кастрюли — меньше: долькам нужно место. Перед каждой партией возвращайте масло к указанной температуре. На поверхности картофеля перед жаркой не должно быть воды.')
season = [(F,t('3 g, then adjust to taste','3 г, затем по вкусу')),(R,t('1 tsp','1 ч. л.')),(B,t('½ tsp','½ ч. л.')),(G,t('½ tsp','½ ч. л.')),(PE,t('¼ tsp','¼ ч. л.')),(M,t('2 tbsp, optional','2 ст. л., по желанию'))]
main = dict(slug='crispy-potato-wedges', title=t('Crispy twice-fried potato wedges','Хрустящие картофельные дольки во фритюре'), group=t('Potatoes','Картофель'), serves=2,
 blurb=t('Thin wedges with a crisp potato crust and fluffy centre: simmer, lightly roughen, dry, fry, cool and fry again.','Тонкие дольки с хрустящей картофельной корочкой и нежной серединой: отварите, слегка разрыхлите поверхность, обсушите и обжарьте дважды с охлаждением.'),
 yields=t('2 generous side portions','2 большие порции гарнира'), total=t('~1½–2 h, including cooling and batches','~1½–2 ч, включая охлаждение и жарку партиями'),
 intro=t('The closest match to roughened roast potatoes, adapted for a deep fryer. <b>Two trips into the oil: 130 °C, then 185 °C.</b> The simmer is a separate cooking stage. Slender wedges give more crust per bite than whole baby potatoes. This is a source-informed home adaptation, not a kitchen-tested recipe. For a light batter shell instead, see <a href="potato-wedge-tempura.html">potato wedge tempura</a>.','Ближайший аналог запечённого картофеля с разрыхлённой поверхностью — во фритюре. <b>Два погружения в масло: 130 °C, затем 185 °C.</b> Варка — отдельный этап. В тонких дольках больше корочки на каждый кусочек, чем в целом молодом картофеле. Это домашняя адаптация по источникам; рецепт пока не проверен на кухне. Для лёгкой оболочки из кляра смотрите <a href="potato-wedge-tempura.html">картофельные дольки в темпуре</a>.'),
 equipment=equipment,
 ingredients=[(t('Potatoes and simmering water','Картофель и вода для варки'),[(P,t('500 g','500 г')),(W,t('2000 ml','2000 мл')),(S,t('20 g','20 г'))]),(t('Frying','Для фритюра'),[(O,t('to the fryer fill line, or 5 cm depth in a tall pot','до отметки фритюрницы или слоем 5 см в высокой кастрюле'))]),(t('Finishing seasoning','Приправа для подачи'),season)],
 mise=[dict(name=t('Potato wedges','Картофельные дольки'),items=t('peeled; cut lengthwise, 15 mm at the thickest part','очистить; нарезать вдоль, 15 мм в самой толстой части'),draw=[],goes_in='Step 1',vessel='plate'),dict(name=t('Finishing seasoning','Приправа для подачи'),items=t('salt · oregano · basil · garlic powder · pepper','соль · орегано · базилик · сушёный чеснок · перец'),draw=[],goes_in='Step 6',vessel='cup')],
 steps=[
  step(t('Cut slender wedges','Нарежьте тонкие дольки'),[cut],time=t('~10 min','~10 мин'),uses=[P]),
  step(t('Simmer until just tender','Отварите до мягкости'),[boil],heat=t('gentle simmer','слабое кипение'),time=t('7–10 min after returning to a simmer','7–10 мин после повторного закипания'),uses=[W,S]),
  step(t('Drain, lightly roughen and dry','Слейте воду, разрыхлите поверхность и обсушите'),[t('Drain thoroughly; do not rinse. Return to the empty warm pan, leave uncovered for 2 minutes, then give <b>2–3 gentle shakes</b>. Stop as soon as the cut faces look lightly scuffed. Do not beat them into mash.','Полностью слейте воду; не промывайте. Верните в пустую тёплую кастрюлю, оставьте без крышки на 2 минуты, затем <b>2–3 раза слегка встряхните</b>. Остановитесь, когда срезы станут немного шероховатыми. Не превращайте дольки в пюре.'),t('Spread on a rack in one layer. Let steam escape for 10 minutes, then refrigerate uncovered for about <b>30 minutes</b>, until cool, firm and dry on the surface. Dryness is essential; no water droplets should remain.','Разложите на решётке в один слой. Дайте пару выйти в течение 10 минут, затем уберите без крышки в холодильник примерно на <b>30 минут</b>: дольки должны остыть, уплотниться и подсохнуть снаружи. Капель воды быть не должно.')],heat='off',time=t('~40 min','~40 мин')),
  step(t('First fry; cool again','Первая жарка; снова охладите'),[oil_note,t('Heat oil to <b>130 °C</b>. Lower dry wedges gently and fry for <b>5–7 minutes per batch</b>, until a thin crust sets but the potatoes stay pale. Move carefully; the first crust is fragile.','Нагрейте масло до <b>130 °C</b>. Аккуратно опустите сухие дольки и жарьте <b>5–7 минут на партию</b>, пока не схватится тонкая корочка; картофель должен остаться светлым. Перекладывайте осторожно: первая корочка хрупкая.'),t('Drain separately on the rack. Let each batch stop steaming, then chill uncovered for <b>20–30 minutes</b>, until cool and firm. Complete this first fry for all batches before the final fry.','Дайте маслу стечь на решётке, не складывая дольки друг на друга. Когда каждая партия перестанет парить, охладите её без крышки <b>20–30 минут</b>, до уплотнения. Сначала обжарьте так все партии, затем переходите к финальной жарке.')],heat=t('130 °C oil','масло 130 °C'),time=t('5–7 min per batch + 20–30 min cooling','5–7 мин на партию + 20–30 мин охлаждения'),uses=[O]),
  step(t('Second fry until golden','Вторая жарка до золотистой корочки'),[t('Raise the oil to <b>185 °C</b>. Fry the cooled wedges in small batches for about <b>3–5 minutes</b>, turning gently, until golden with a rigid crisp surface. Stop at golden rather than dark brown. Drain on a rack for 30–60 seconds.','Нагрейте масло до <b>185 °C</b>. Жарьте остывшие дольки небольшими партиями примерно <b>3–5 минут</b>, аккуратно переворачивая, до золотистого цвета и твёрдой хрустящей поверхности. Не доводите до тёмно-коричневого цвета. Дайте маслу стечь на решётке 30–60 секунд.')],heat=t('185 °C oil','масло 185 °C'),time=t('3–5 min per batch','3–5 мин на партию')),
  step(t('Season and eat immediately','Приправьте и сразу подавайте'),[t('Mix the finishing salt, oregano, basil, garlic powder and pepper; crush the herbs between your fingers. Toss with the hot drained wedges, taste, then adjust the salt. Serve immediately with optional mayonnaise on the side. Keep the wedges uncovered and avoid piling them deeply.','Смешайте соль для подачи, орегано, базилик, сушёный чеснок и перец; разотрите травы пальцами. Перемешайте с горячими дольками, с которых стекло масло, попробуйте и при необходимости досолите. Сразу подавайте с майонезом отдельно. Не накрывайте и не складывайте высокой горкой.')],uses=[F,R,B,G,PE,M])],
 notes=[
 (t('Baking soda: optional, not essential','Сода: по желанию'),t('The shake roughens softened potato; it does not create new starch. Baking soda makes the cooking water alkaline and helps the outer potato break down. For more roughness, add only <b>⅛ tsp (about 0.6 g) ordinary baking soda to the original 2 litres of water</b>, before the potatoes. Start checking at 4–5 minutes and shake even less. Do not use baking powder or baked baking soda. For a first batch, skip it: slender floury wedges roughen readily and are easier to handle without it.','Встряхивание разрыхляет размягчённый картофель, а не создаёт новый крахмал. Сода делает воду щелочной и ускоряет размягчение внешнего слоя. Для более шероховатой поверхности добавьте всего <b>⅛ ч. л. (около 0,6 г) обычной пищевой соды на исходные 2 литра воды</b>, до картофеля. Проверяйте с 4–5-й минуты и встряхивайте ещё осторожнее. Не используйте разрыхлитель или прокалённую соду. Для первой попытки лучше обойтись без соды: тонкие рассыпчатые дольки легко разрыхляются и так.')),
 (t('Why these potatoes and this cut','Почему именно такой картофель и нарезка'),t('Floury mature potatoes give the fluffy centre you want. Waxy baby potatoes stay creamier and denser. A count of six wedges only works for medium potatoes: measure the cut face. This timing is for 15 mm wedges; 10 mm pieces cook faster and 20 mm pieces need a longer simmer. Test tenderness rather than borrowing the same times.','Зрелый рассыпчатый картофель даёт нежную рыхлую середину. Молодой восковой картофель остаётся более плотным и кремовым. Шесть долек подходят только для средних картофелин: измеряйте толщину. Это расписание для долек по 15 мм; кусочки по 10 мм готовятся быстрее, а по 20 мм требуют более долгой варки. Проверяйте мягкость, а не переносите время без изменений.')),
 (t('Herbs go on after frying','Травы добавляют после жарки'),t('Oregano, basil, garlic powder and pepper go on after the final fry so they keep their flavour without scorching in hot oil. Keep sauces beside the potatoes to preserve the crust. For make-ahead cooking, refrigerate the cooled first-fried wedges, covered once cold, and use within 24 hours. Uncover and check they are surface-dry before the final fry.','Орегано, базилик, сушёный чеснок и перец добавляют после последней жарки: так они сохраняют аромат и не сгорают в масле. Соусы подавайте отдельно, чтобы сохранить корочку. Для заготовки охладите дольки после первой жарки, накройте уже холодными и храните в холодильнике не дольше 24 часов. Перед финальной жаркой откройте и убедитесь, что поверхность сухая.'))],
 sources=[('Smoked BBQ Source — triple-cooked potato wedges','https://www.smokedbbqsource.com/triple-cooked-potato-wedges/'),('Cookipedia — triple-cooked chips','https://www.cookipedia.co.uk/recipes_wiki/Heston_Blumenthal%27s_Triple_Cooked_Chips'),('Serious Eats — alkaline-water roast potatoes','https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe'),('Epicurious — precooked ½-inch potato wedges','https://www.epicurious.com/recipes/food/views/crispy-spiced-potato-wedges-56390102')])

C = t('Cornstarch for dusting','Кукурузный крахмал для обсыпки')
TM = t('Dry tempura batter mix','Сухая смесь для темпуры')
IW = t('Ice-cold water for the mix','Ледяная вода для смеси')
temp = dict(slug='potato-wedge-tempura',title=t('Potato wedge tempura with oregano and basil','Картофельные дольки в темпуре с орегано и базиликом'),group='Potatoes',serves=2,
 blurb=t('Precooked slender potato wedges in a light tempura shell, with oregano and basil added after frying. Works with packaged shrimp tempura mix.','Предварительно отваренные тонкие дольки в лёгкой оболочке из кляра, с орегано и базиликом после жарки. Подойдёт готовая смесь для креветочной темпуры.'),
 yields=main['yields'], total=t('~1–1¼ h, including drying and frying in batches','~1–1¼ ч, включая обсушивание и жарку партиями'),
 intro=t('<b>One trip into the oil at 175 °C</b>, after simmering and drying the potatoes. A dry tempura mix sold for shrimp works for vegetables too: use its packet water ratio. This herb seasoning is a fusion variation. For a potato-only crust and two fries, see <a href="crispy-potato-wedges.html">crispy twice-fried wedges</a>. This is a source-informed home adaptation, not a kitchen-tested recipe.','<b>Одно погружение в масло при 175 °C</b>, после варки и обсушивания картофеля. Сухая смесь для креветочной темпуры подходит и для овощей: соблюдайте пропорцию воды на упаковке. Травы здесь — вариация фьюжн. Для картофельной корочки с двойной жаркой смотрите <a href="crispy-potato-wedges.html">хрустящие дольки во фритюре</a>. Это домашняя адаптация по источникам; рецепт пока не проверен на кухне.'),
 equipment=equipment+[t('Batter bowl and larger bowl of ice','Миска для кляра и большая миска со льдом')],
 ingredients=[main['ingredients'][0],(t('Light coating','Лёгкий кляр'),[(C,t('15 g','15 г')),(TM,t('100 g','100 г')),(IW,t('per packet for 100 g mix','по инструкции на 100 г смеси'))]),main['ingredients'][1],main['ingredients'][2]],
 mise=[main['mise'][0],dict(name=t('Tempura ingredients','Ингредиенты для темпуры'),items=t('dry mix · cornstarch · ice-cold water','сухая смесь · крахмал · ледяная вода'),draw=[],goes_in='Step 3',vessel='bowl')],
 steps=[
 step(t('Cut and simmer the wedges','Нарежьте и отварите дольки'),[cut,boil,t('Do not add baking soda and do not roughen these wedges: an intact surface holds the thin batter better.','Не добавляйте соду и не разрыхляйте эти дольки: тонкий кляр лучше держится на целой поверхности.')],heat='gentle simmer',time=t('~20 min','~20 мин'),uses=[P,W,S]),
 step(t('Cool and dry thoroughly','Полностью остудите и обсушите'),[t('Drain gently and spread apart on a rack. Let steam escape for 10 minutes, then refrigerate uncovered about <b>20 minutes</b>, until cool and surface-dry. Pat away any remaining droplets. Prepare the finishing seasoning while they cool.','Аккуратно слейте воду и разложите на решётке с промежутками. Дайте пару выйти за 10 минут, затем охладите без крышки примерно <b>20 минут</b>, до остывания и сухой поверхности. Промокните оставшиеся капли. Пока картофель остывает, смешайте приправу для подачи.')],heat='off',time=t('~30 min','~30 мин')),
 step(t('Mix cold batter and coat a few wedges','Смешайте холодный кляр и обмакните несколько долек'),[oil_note,t('Heat oil to <b>175 °C</b>. Prepare 100 g dry tempura mix with ice-cold water in the <b>packet ratio</b>, including egg only if the packet requires it. Keep the bowl over ice, with ice outside the batter. Mix as the packet directs and use promptly; the coating should run off a spoon in a thin film.','Нагрейте масло до <b>175 °C</b>. Разведите 100 г сухой смеси ледяной водой <b>в пропорции на упаковке</b>; яйцо добавляйте только по инструкции. Держите миску на льду, чтобы лёд оставался снаружи кляра. Смешивайте по инструкции и используйте сразу: со ложки должна стекать тонкая плёнка.'),t('Dust only a few dry wedges lightly with cornstarch, tap off excess, then dip in batter and let excess drip. Coat each batch immediately before frying. Do not bread with dry tempura mix or add cooked tempura crumbs to the batter.','Слегка припылите крахмалом несколько сухих долек, стряхните излишек, обмакните в кляр и дайте лишнему стечь. Покрывайте каждую партию непосредственно перед жаркой. Не панируйте в сухой смеси для темпуры и не добавляйте в кляр готовую жареную крошку.')],heat=t('175 °C oil','масло 175 °C'),time=t('~5 min','~5 мин'),uses=[C,TM,IW,O]),
 step(t('Fry once until the shell is crisp','Обжарьте один раз до хрустящей корочки'),[t('Lower <b>3–5 wedges</b> individually into the oil, without touching. In an electric fryer lower the empty basket first, then add battered wedges according to its instructions so the wet coating does not glue itself around the mesh.','Опускайте в масло по одной <b>3–5 долек</b>, чтобы они не соприкасались. Во фритюрнице сначала опустите пустую корзину, затем добавляйте дольки в кляре по инструкции прибора, чтобы влажное покрытие не приклеилось к сетке.'),t('Maintain <b>170–175 °C</b> while frying for about <b>4–5 minutes</b>, turning once, until the thin shell is crisp and pale gold and the potato is hot through. Open one thick wedge to check. Skim loose batter and restore 175 °C before the next batch. There is <b>no second fry</b> in this version.','Поддерживайте <b>170–175 °C</b> и жарьте примерно <b>4–5 минут</b>, перевернув один раз, пока тонкая оболочка не станет хрустящей и светло-золотистой, а картофель не прогреется внутри. Разломите толстую дольку для проверки. Убирайте крошки кляра и возвращайте масло к 175 °C перед следующей партией. В этом варианте <b>второй жарки нет</b>.')],heat=t('170–175 °C oil','масло 170–175 °C'),time=t('4–5 min per batch','4–5 мин на партию')),
 step(t('Drain, season and serve','Дайте маслу стечь, приправьте и подавайте'),[t('Drain on a rack for 30–60 seconds. Sprinkle with the mixed salt, oregano, basil, garlic powder and pepper while hot, tasting before adding it all. Serve immediately, without covering or piling up, with optional mayonnaise on the side.','Дайте маслу стечь на решётке 30–60 секунд. Посыпьте горячие дольки смесью соли, орегано, базилика, сушёного чеснока и перца; пробуйте, прежде чем добавить всё. Сразу подавайте, не накрывая и не складывая горкой, с майонезом отдельно.')],uses=[F,R,B,G,PE,M])],
 notes=[
 (t('No packet mix?','Нет готовой смеси?'),t('Instead of the packet mix and its water, use <b>80 g plain flour + 20 g cornstarch + 150 ml ice-cold sparkling water</b>. Stir briefly with a fork, leaving a few small lumps. No egg needed. Keep the separate 15 g dusting cornstarch. This is an alternative batter, not an addition to the packet mix.','Вместо готовой смеси и воды для неё возьмите <b>80 г пшеничной муки + 20 г кукурузного крахмала + 150 мл ледяной газированной воды</b>. Недолго перемешайте вилкой, оставляя небольшие комочки. Яйцо не нужно. Отдельные 15 г крахмала для обсыпки сохраняются. Это замена готовой смеси, а не добавка к ней.')),
 (t('Tempura mix, tempura bits or panko?','Смесь для темпуры, крошка или панко?'),t('<b>Tempura mix</b> is uncooked powder that becomes batter with water. <b>Tenkasu/agedama</b> are already-fried batter bits: sprinkle a spoonful on the finished dish if you like; frying them again can burn them. <b>Panko</b> are breadcrumbs for a different breaded coating. If your package says shrimp tempura batter mix, use it here.','<b>Смесь для темпуры</b> — сырой порошок, из которого с водой делают кляр. <b>Тэнкасу/агэдама</b> — уже обжаренные кусочки кляра: при желании посыпьте готовое блюдо ложкой крошки; повторная жарка может её сжечь. <b>Панко</b> — сухари для другого вида панировки. Если на упаковке написано «смесь для креветочной темпуры», она подойдёт.')),
 (t('Why precook and only fry once?','Зачем варить заранее и жарить один раз?'),t('A raw 15 mm wedge can stay hard inside while tempura browns. Simmering first separates those jobs: the potato becomes tender, then frying cooks the thin shell and reheats the centre. A second hot fry is useful for bare potato crust, but this thin batter shell is ready after one fry. For raw potato tempura, use a separate recipe for thin 5 mm slices.','Сырая долька толщиной 15 мм может остаться твёрдой внутри, пока темпура уже подрумянится. Предварительная варка разделяет задачи: картофель становится мягким, а жарка готовит тонкую оболочку и прогревает середину. Повторная горячая жарка полезна для картофельной корочки, но этому тонкому кляру достаточно одной. Для темпуры из сырого картофеля используйте отдельный рецепт с ломтиками по 5 мм.'))],
 sources=[('Idaho Potato Commission / Tiffani Faison — precooked potato tempura','https://www.idahopotato.com/recipes/crispy-chili-potatoes'),('J-Simple Recipes — thin-sliced potato tempura','https://j-simplerecipes.com/recipes_metric/vegetable/potato-tempura.html'),('Just One Cookbook — tenkasu / agedama','https://www.justonecookbook.com/tenkasu-agedama/')])

# Keep the packet water instruction correct when the serving control scales the mix.
for name, items in temp['ingredients']:
    for i, (ingredient, amount) in enumerate(items):
        if ingredient == IW:
            items[i] = (ingredient, t('per packet for the amount of mix shown', 'по инструкции для указанного количества смеси'))

main['notes'].append((
 t('If the crust is soft or the wedges break', 'Если корочка мягкая или дольки ломаются'),
 t('Soft or greasy crust: dry the potatoes more thoroughly, fry smaller batches and let the oil recover before each load. A hard centre means the simmer was too short; it should already be tender before frying. Broken wedges mean too much boiling, soda or shaking: reduce one of those next time. Serve uncovered on a rack rather than piling hot wedges into a bowl. If an electric fryer cannot hold 130 °C, use a tall pot and thermometer for the first fry; do not keep the same timing at an arbitrarily hotter setting.', 'Мягкая или жирная корочка: лучше обсушите картофель, уменьшите партии и давайте маслу возвращаться к нужной температуре. Твёрдая середина означает слишком короткую варку: до фритюра она уже должна быть мягкой. Дольки ломаются от слишком долгой варки, избытка соды или сильного встряхивания: в следующий раз уменьшите один из этих факторов. Подавайте без крышки, не складывая горячий картофель горкой. Если фритюрница не держит 130 °C, используйте для первой жарки высокую кастрюлю с термометром; не переносите то же время на произвольную более высокую температуру.')
))
temp['notes'].append((
 t('A thin shell that sticks to the potato', 'Тонкая оболочка, которая держится на картофеле'),
 t('Coating slips off: the potato was wet, the starch layer was too thick, or the batter was too runny. Pat the potato dry, leave only a faint starch film and let excess batter drip off. Heavy or greasy coating: keep the batter cold, avoid overmixing and restore the oil temperature between small batches. The homemade batter quantities in the note are for the original 500 g potato batch; multiply them by the same factor as the potatoes when changing servings.', 'Кляр сползает: картофель был влажным, слой крахмала слишком толстым или кляр слишком жидким. Обсушите дольки, оставьте лишь тонкую плёнку крахмала и дайте излишку кляра стечь. Тяжёлая или жирная оболочка: держите кляр холодным, не перемешивайте долго и восстанавливайте температуру масла между небольшими партиями. Количества домашнего кляра в примечании рассчитаны на исходные 500 г картофеля; при изменении порций умножайте их на тот же коэффициент, что и картофель.')
))
t('First fry at 130 °C', 'Первая жарка при 130 °C')

for value in ('off',):
    t(value, 'без нагрева')
for r in (main,temp):
    for label,_ in r['sources']:
        t(label, label.replace(' — ', ' — источник: '))

# Later steps reuse the original measured potato batch; no extra potatoes or oil.
for recipe in (main, temp):
    for stage in recipe['steps']:
        if P not in stage['uses']:
            stage['uses'].insert(0, P)
main['steps'][4]['uses'].append(O)

DATA = [main,temp]
for recipe in DATA:
    recipe['added'] = '2026-11-11T10:33:36Z'
module = '''"""Crispy potato wedges: source-informed home adaptations; see ilyadays art/crispy-potatoes."""
import json
from pathlib import Path
from kit import Recipe, Step, Bowl

def load():
    rows = json.loads(Path(__file__).with_suffix('.json').read_text())
    for row in rows:
        row['steps'] = [Step(**s) for s in row['steps']]
        row['mise'] = [Bowl(**b) for b in row['mise']]
        yield Recipe(**row)

RECIPES = list(load())
'''
def write(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(value)

write(CANON/'src/potato_wedges.py',module)
write(CANON/'src/potato_wedges.json',json.dumps(DATA,ensure_ascii=False,indent=2)+'\n')
for r in DATA:
    write(CANON/f'src/i18n/ru/{r["slug"]}.json',json.dumps(TR,ensure_ascii=False,indent=1)+'\n')

content = CANON/'src/content.py'
text = content.read_text()
if 'import potato_wedges' not in text:
    text = text.replace('import sous_vide_tempura  # noqa: E402','import sous_vide_tempura  # noqa: E402\nimport potato_wedges  # noqa: E402')
    text = text.replace('    sous_vide_beets, *sous_vide_tempura.RECIPES,','    *potato_wedges.RECIPES, sous_vide_beets, *sous_vide_tempura.RECIPES,')
    text = text.replace('GROUPS = ["Turkish & coastal"','GROUPS = ["Potatoes", "Turkish & coastal"')
    content.write_text(text)
site = CANON/'src/i18n/ru/site.json'
v = json.loads(site.read_text()); v['Potatoes']='Картофель'; site.write_text(json.dumps(v,ensure_ascii=False,indent=1)+'\n')
print('Wrote two canonical recipes, Russian translations, registration and group.')
