"""Reusable bilingual Turkish/coastal recipes; source data lives beside this module.
Run this file after editing JSON to refresh the exact-string Russian translations.
The site exports these Recipe instances; Travel owns season and shopping research.
"""
import json
import re
from pathlib import Path
from kit import Recipe, Step

DATA = json.loads(Path(__file__).with_suffix('.json').read_text())
RECIPES = []
TRANSLATIONS = {}

def amount_ru(s):
    return (s.replace('large sheets', 'больших листа').replace('small clove', 'небольшой зубчик')
            .replace('cloves', 'зубчика').replace('a pinch', 'щепотка')
            .replace('tbsp', 'ст. л.').replace('tsp', 'ч. л.').replace(' g', ' г'))

for item in DATA:
    tr = {}
    def t(pair):
        en, ru = pair
        tr[en] = ru
        return en
    ingredients = []
    for key, heading in [('core', ('Core ingredients', 'Основные ингредиенты')), ('optional', ('Optional additions', 'Необязательные добавки'))]:
        rows = []
        for line in item[key].splitlines():
            en, ru, amount = line.split('~')
            rows.append((t((en, ru)), t((amount, amount_ru(amount)))))
        ingredients.append((t(heading), rows))
    context = t(('Planned for Göcek, Turkey · 24 October–around 7 November 2026. Also works in a home kitchen. See the <a href="/travel/turkey-yacht-food#shopping">seasonal shopping and supplier guide</a>.',
                 'Для Гёчека, Турция · 24 октября–примерно 7 ноября 2026. Подходит и для домашней кухни. См. <a href="/ru/travel/turkey-yacht-food#shopping">сезонные закупки и поставщиков</a>.'))
    simple_title = t(('Simplified version', 'Упрощённая версия'))
    simple = t(item['simple'])
    simple_html = f'<div class="note"><h3>{simple_title}</h3><p>{simple}</p></div>'
    tr[simple_html] = f'<div class="note"><h3>{tr[simple_title]}</h3><p>{tr[simple]}</p></div>'
    equipment = [t(x) for x in [('Sharp knife and stable cutting board', 'Острый нож и устойчивая разделочная доска'), ('Mixing bowl and spoon', 'Миска и ложка')]]
    if item['slug'] == 'yacht-sashimi':
        equipment += [t(x) for x in [('Fridge thermometer, cooler and ice', 'Термометр в холодильнике, термосумка и лёд'), ('Clean long slicing knife and chilled plates', 'Чистый длинный нож и охлаждённые тарелки')]]
    elif item['slug'] not in ('gavurdagi-salad', 'pomegranate-salad'):
        equipment += [t(x) for x in [('Hob and frying pan', 'Плита и сковорода'), ('Food thermometer', 'Кухонный термометр')]]
    if item['slug'] == 'cilbir': equipment += [t(('Wide pot and slotted spoon', 'Широкая кастрюля и шумовка'))]
    if item['slug'] == 'kabak-mucver': equipment += [t(('Coarse grater and clean tea towel', 'Крупная тёрка и чистое полотенце'))]
    specific = {
        'lemon-caper-dorada': [('Fish-bone tweezers and broad fish spatula', 'Рыбный пинцет и широкая лопатка')],
        'ali-nazik': [('Sieve for draining aubergine', 'Сито для баклажана')],
        'kabak-mucver': [('Paper towels or draining rack', 'Бумажные полотенца или решётка')],
        'cokertme': [('Slotted turner, draining rack and heatproof oil container', 'Лопатка с прорезями, решётка и жаропрочная ёмкость для масла')],
        'cilbir': [('Small cups and clean draining paper', 'Маленькие чашки и чистая бумага для обсушивания')],
        'garlic-chilli-shrimp': [('Kitchen tongs and clean plate for batches', 'Кухонные щипцы и чистая тарелка для партий')],
    }
    equipment += [t(x) for x in specific.get(item['slug'], [])]
    notes = [(t(title), t(body)) for title, body in item['notes']]
    notes.append((t(('Core and optional', 'Основное и необязательное')), t(('Make the core ingredient list first. Optional additions are separate; each is called out where it enters. Quantities serve two. Cook meat and seafood just before eating; keep dairy and raw ingredients refrigerated at 0–4 °C. Prep vegetables before raw meat or use a separate board and clean tools.', 'Сначала соберите основные ингредиенты. Необязательные добавки вынесены отдельно; в шагах указано, когда их добавлять. Количества на двоих. Мясо и морепродукты готовьте перед едой; молочное и сырые продукты держите при 0–4 °C. Подготовьте овощи до сырого мяса или используйте отдельную доску и чистые инструменты.'))))
    heat_ru = {'medium-high': 'выше среднего', 'medium-low': 'слабый-средний', 'medium': 'средний', 'high': 'сильный', 'low': 'слабый'}
    steps = [Step(t(x['title']), t(x['body']), time=t(x['time']), heat=t((x['heat'], heat_ru.get(x['heat'], x['heat']))) if x['heat'] else '') for x in item['steps']]
    recipe = Recipe(slug=item['slug'], title=t(item['title']), group='Turkish & coastal', blurb=t(item['blurb']),
                    yields=t(('2 portions', '2 порции')), total=t(item['total']), serves=2,
                    intro=t(item['blurb']) + ' ' + context,
                    ingredients=ingredients, equipment=equipment, before_ingredients=simple_html,
                    steps=steps, notes=notes, sources=[(t((en, ru)), url) for en, ru, url in item['sources']])
    for i, step in enumerate(recipe.steps, 1):
        # Enable the existing full-size picture link without generating a diagram.
        def picture_only():
            return None
        picture_only.picture_key = str(i)
        step.diagram = picture_only
    # localize() translates the whole introduction, so register its assembled string too.
    tr[recipe.intro] = tr[item['blurb'][0]] + ' ' + tr[context]
    RECIPES.append(recipe)
    TRANSLATIONS[recipe.slug] = tr

if __name__ == '__main__':
    for slug, tr in TRANSLATIONS.items():
        (Path(__file__).parent / 'i18n' / 'ru' / f'{slug}.json').write_text(json.dumps(tr, ensure_ascii=False, indent=2) + '\n')
    print(f'Updated translations for {len(RECIPES)} recipes.')
