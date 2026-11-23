#!/usr/bin/env python3
"""Browser check for the Stoic Constitution page (public/apps/stoic-constitution.html).

Usage: apps/aurelius/.venv/bin/python scripts/aurelius-constitution-check.py [--port 3170] [--quick]

Needs the dev server (npx next dev -p 3170). For every chapter that has articles, at 360×740 dark,
390×844 light and 1440×1000 light, with and without ?with=seneca, it opens the page, opens every third
"Show the quotes" panel and reports: horizontal overflow (must be 0), text under 12 px (0), visible
buttons shorter than 40 px (0), articles drawn (must equal the chapter's articles) and console or page
errors (none). At 1440 px it also hovers every traced phrase and every map mark (unless --quick), and
checks the layout rule: the vectors column never pushes the five sides down, and stays on screen beside
them. Exits 1 if any check fails.

Then it runs named cases (rows P1 to P12 of plan/stoicism/34-after-review-plan.md), each a scenario that once
failed on the page: a selection that must stay on its words across a voice switch, honest counts after removing
passages, a verdict that cannot be saved, chapter navigation in a simulated second chapter (Articles 4 to 6 served
as chapter c3), a chapter file that does not match the index, the phone bar, and the source list for picked words.
  --cases P1,P4   run only these cases (and no sweep)      --no-cases   run only the sweep
"""
import argparse
import copy
import json
import re
import sys
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(360, 740, 'dark'), (390, 844, 'light'), (1440, 1000, 'light')]

MEASURE = """() => {
  const visible = n => n.offsetParent !== null && n.getBoundingClientRect().width > 0;
  return {
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('main *')].filter(n => n.children.length === 0 && n.textContent.trim() && visible(n)
      && parseFloat(getComputedStyle(n).fontSize) < 12).map(n => n.tagName + '.' + n.className + ' “' + n.textContent.trim().slice(0, 30) + '”').slice(0, 5),
    short: [...document.querySelectorAll('main button, .dock button, .bar button')].filter(n => visible(n) && n.getBoundingClientRect().height < 40)
      .map(n => (n.className || n.tagName) + ' “' + n.textContent.trim().slice(0, 24) + '” ' + Math.round(n.getBoundingClientRect().height)).slice(0, 5),
    articles: [...document.querySelectorAll('article.article')].map(n => n.id),
  };
}"""

LAYOUT = """() => [...document.querySelectorAll('article.article')].map(a => {
  const lead = a.querySelector('.lead-col').getBoundingClientRect(), sides = a.querySelector('.grps').getBoundingClientRect();
  return {id: a.id, gap: Math.round(sides.top - lead.bottom)};
})"""


def chapters(port: int) -> list[tuple[str | None, list[int]]]:
    """Chapters that have articles, with their article numbers, read from the published index."""
    index = json.loads(urlopen(f'http://localhost:{port}/apps/stoic-constitution.json').read())
    by_chapter: dict[str | None, list[int]] = {}
    for article in index['articles']:
        by_chapter.setdefault(article.get('chapter'), []).append(article['number'])
    return list(by_chapter.items())


# ---------------------------------------------------------------- named cases
VERDICT_KEY = 'stoic-constitution:v1:verdicts'


def two_chapters(port: int) -> tuple[dict, dict]:
    """An index and chapter files in which Articles 4 to 6 belong to chapter c3 (order 2): same data, two chapters."""
    index = json.loads(urlopen(f'http://localhost:{port}/apps/stoic-constitution.json').read())
    full = json.loads(urlopen(f'http://localhost:{port}/apps/stoic-constitution/c6.json').read())['articles']
    for stub in index['articles']:
        if stub['number'] >= 4:
            stub['chapter'] = 'c3'
    c3 = next(c for c in index['chapters'] if c['id'] == 'c3')
    c6 = next(c for c in index['chapters'] if c['id'] == 'c6')
    moved = [s for s in c6['sections'] if s.get('article') and s['article'] >= 4]
    c6['sections'] = [s for s in c6['sections'] if s not in moved]
    c3['sections'] = moved + c3['sections']
    return index, {'c6': {'chapter': 'c6', 'articles': full[:3]}, 'c3': {'chapter': 'c3', 'articles': full[3:]}}


def serve(page, index: dict | None, files: dict):
    if index is not None:
        page.route('**/apps/stoic-constitution.json', lambda r: r.fulfill(json=index))
    for name, data in files.items():
        page.route(f'**/stoic-constitution/{name}.json', (lambda d: (lambda r: d(r) if callable(d) else r.fulfill(json=d)))(data))


def shown(page) -> list[int]:
    return page.evaluate("[...document.querySelectorAll('article.article')].map(a => Number(a.id.replace('article-', '')))")


def span(page, number: int, text: str):
    return page.locator(f'#article-{number} .sg').filter(has_text=re.compile('^' + re.escape(text) + '$'))


def picked(page, number: int) -> list[str]:
    return page.evaluate(f"[...document.querySelectorAll('#article-{number} .sg[aria-pressed=true]')].map(n => n.textContent)")


def agree(page, number: int) -> list[str]:
    """The picked words, the source list under them, the highlighted quotes and the map must name the same passages."""
    return page.evaluate("""n => {
      const out = [], a = document.getElementById('article-' + n), sel = [...a.querySelectorAll('.sg[aria-pressed=true]')];
      if (sel.length !== 1) return sel.length ? ['more than one phrase is picked'] : [];
      const refs = (sel[0].dataset.refs || '').split('|').filter(Boolean).sort();
      const list = [...a.querySelectorAll('.picked [data-ref]')].map(r => r.dataset.ref).sort();
      if (JSON.stringify(list) !== JSON.stringify(refs)) out.push('source list ' + JSON.stringify(list) + ' vs picked words ' + JSON.stringify(refs));
      const hits = [...a.querySelectorAll('.pair.hit')].map(r => r.dataset.ref).filter(Boolean);
      if (hits.some(ref => !refs.includes(ref))) out.push('highlighted quotes ' + JSON.stringify(hits) + ' are not behind the picked words');
      const onMap = [...a.querySelectorAll('svg.map .pt')].map(p => p.dataset.ref);
      const lit = [...a.querySelectorAll('svg.map .pt:not(.dim)')].map(p => p.dataset.ref).sort();
      const want = refs.filter(r => onMap.includes(r)).sort();
      if (JSON.stringify(lit) !== JSON.stringify(want)) out.push('map picks out ' + JSON.stringify(lit) + ', words say ' + JSON.stringify(want));
      return out;
    }""", number)


def voice(page):
    page.locator('.dock button.voice').first.click()
    page.wait_for_timeout(250)


def case_p1(page, base, port):
    problems = []
    for start_on, phrase in [(False, 'fit myself to it'), (True, None)]:
        page.goto(base + ('?with=seneca' if start_on else ''), wait_until='networkidle')
        page.wait_for_selector('#article-3 .statement')
        if phrase:
            target = span(page, 3, phrase)
        else:   # with Seneca on, the first phrase of claim 4 that Seneca also backs
            target = page.locator('#article-3 li.claim .sg[data-refs*="Ep."]').first
            phrase = target.text_content()
        target.scroll_into_view_if_needed()
        target.click()
        before = picked(page, 3)
        voice(page)
        after = picked(page, 3)
        if before != [phrase]:
            problems.append(f'picking “{phrase}” picked {before}')
        if after and after != [phrase]:
            problems.append(f"Seneca {'off' if start_on else 'on'}: the pick moved from “{phrase}” to {after}")
        problems += [f'after the switch: {p}' for p in agree(page, 3)]
    return problems


def case_p2(page, base, port):
    problems = []
    card = lambda: page.locator('#article-6 li.claim').filter(has_text='Every part of the world').first
    page.goto(base + '?without=6:4.19#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    head = card().locator('.fused b').first.text_content()
    if '2 of 3 passages remain for this claim' not in head:
        problems.append(f'4.19 removed: the card says “{head}”, not “2 of 3 passages remain for this claim”')
    page.goto(base + '?with=seneca&without=6:4.19,6.38,10.22#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    head = card().locator('.fused b').first.text_content()
    if 'what remains is Seneca' not in head:
        problems.append(f'all three removed: the card says “{head}”')
    struck = card().locator('.sg.gone').filter(has_text='all of them work toward one end').count()
    if struck:
        problems.append('words that Seneca still backs are struck through')
    for ref in ['6.38', '4.19', '10.22']:
        chip = card().locator('.fused span').filter(has_text=re.compile('^' + re.escape(ref) + '( removed)?$'))
        if not chip.count() or 'removed' not in (chip.first.text_content() + (chip.first.get_attribute('aria-label') or '')):
            problems.append(f'the chip for {ref} is not visibly marked removed')
    return problems


def case_p3(page, base, port):
    page.add_init_script("(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === '%s') throw new Error('QuotaExceededError'); return set.call(this, k, v); }; })()" % VERDICT_KEY)
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .verdict')
    page.locator('#article-6 .vb', has_text='Keep').click()
    problems = []
    if page.locator('#article-6 .vb', has_text='Keep').get_attribute('aria-pressed') != 'true':
        problems.append('Keep springs back when the browser refuses to save it')
    if 'could not be saved on this device' not in page.locator('#article-6 .verdict').text_content().lower():
        problems.append('nothing says the verdict could not be saved')
    if not re.search(r'Article 6 · .*Keep', page.locator('#mine').text_content()):
        problems.append('the verdict is missing from the list that is copied')
    return problems


def sim(page, base, port, query=''):
    index, files = two_chapters(port)
    serve(page, index, files)
    page.goto(base + query, wait_until='networkidle')
    page.wait_for_selector('article.article .statement')


def switch(page, title):
    page.locator('.chap-btn').click()
    page.locator('#chapters button', has_text=title).click()
    page.wait_for_selector('#article-6 .statement')
    page.wait_for_timeout(900)


def case_p4(page, base, port):
    sim(page, base, port, '?with=seneca')
    switch(page, 'The life within')
    page.go_back()
    page.wait_for_timeout(700)
    problems = []
    if 'stoic-constitution' not in page.url:
        return ['Back leaves the constitution after a chapter switch']
    if shown(page) != [1, 2, 3]:
        problems.append(f'Back shows articles {shown(page)}, not chapter 1')
    page.go_forward()
    page.wait_for_timeout(700)
    if shown(page) != [4, 5, 6]:
        problems.append(f'Forward shows articles {shown(page)}, not chapter 2')
    if 'with=seneca' not in page.url or not page.locator('.sg.add').count():
        problems.append('Seneca was lost going back and forward')
    return problems


def case_p5(page, base, port):
    sim(page, base, port, '?c=c3')
    page.evaluate("location.hash = '#article-2'")
    page.wait_for_timeout(1200)
    return [] if 2 in shown(page) else [f'typing #article-2 in chapter 2 leaves articles {shown(page)} on screen']


def case_p6(page, base, port):
    page.emulate_media(reduced_motion='reduce')
    sim(page, base, port)
    switch(page, 'The life within')
    bar = page.evaluate("document.querySelector('.bar').getBoundingClientRect().bottom")
    head = page.evaluate("document.querySelector('#articles .step').getBoundingClientRect().top")
    return [] if head >= bar - 1 else [f'after a chapter switch the chapter heading starts at {head:.0f}px, under the bar ending at {bar:.0f}px']


def case_p7(page, base, port):
    sim(page, base, port, '?c=c3&without=1:9.7')
    query = page.evaluate("decodeURIComponent(location.search)")
    return [] if 'without=1:9.7' in query else [f'opening chapter 2 dropped the removal in Article 1 from the link: {query}']


def case_p8(page, base, port):
    problems = []
    full = json.loads(urlopen(f'http://localhost:{port}/apps/stoic-constitution/c6.json').read())
    # a) a chapter file that lacks an article the index lists
    serve(page, None, {'c6': {'chapter': 'c6', 'articles': full['articles'][:5]}})
    page.goto(base, wait_until='networkidle')
    page.wait_for_timeout(500)
    text = page.locator('#list').text_content()
    if 'could not be loaded' not in text:
        problems.append(f'a chapter file without Article 6 draws {shown(page)} and says nothing')
    page.unroute('**/stoic-constitution/c6.json')
    # b) a bad file first, a good one on retry
    calls = {'n': 0}
    broken = copy.deepcopy(full)
    del broken['articles'][0]['claims']
    def flaky(route):
        calls['n'] += 1
        route.fulfill(json=broken) if calls['n'] == 1 else route.continue_()
    page.route('**/stoic-constitution/c6.json', flaky)
    page.goto(base, wait_until='networkidle')
    page.wait_for_timeout(500)
    retry = page.locator('#list .act', has_text='Try again')
    if retry.count():
        retry.click()
        page.wait_for_timeout(800)
    if shown(page) != [1, 2, 3, 4, 5, 6]:
        problems.append(f'after the server recovers, Try again leaves {shown(page)} (requests made: {calls["n"]})')
    page.unroute('**/stoic-constitution/c6.json')
    # c) a file that loads but cannot be drawn
    bad = copy.deepcopy(full)
    bad['articles'][2]['claims'][0]['support'] = None
    serve(page, None, {'c6': bad})
    page.goto(base, wait_until='networkidle')
    page.wait_for_timeout(500)
    text = page.locator('#list').text_content()
    if 'Article 3 could not be drawn' not in text:
        problems.append(f'a drawing error is reported as: “{text[:90]}”')
    if page.locator('#list .act', has_text='Try again').count():
        problems.append('a drawing error offers Try again, which cannot help')
    return problems


def case_p9(page, base, port):
    sim(page, base, port)
    switch(page, 'The life within')
    open_ = page.evaluate("[...document.querySelectorAll('#tree details[open] .name')].map(n => n.textContent)")
    return [] if open_ == ['The life within'] else [f'the topic tree has {open_} open while chapter 2 is on screen']


def case_p10(page, base, port):
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    outside = page.evaluate("""[...document.querySelectorAll('.bar .wrap > *')].filter(n => n.offsetParent !== null)
      .filter(n => { const r = n.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).map(n => n.textContent.trim())""")
    problems = [f'bar controls off screen at 360 px: {outside}'] if outside else []
    button = page.locator('.art-btn')
    if not button.count() or not button.is_visible():
        problems.append('no “Article N of M” button on a phone')
    else:
        button.click()
        rows = page.locator('#article-list button').all_text_contents()
        if len(rows) != 6 or not all(re.search('[A-Za-z]{4}', r) for r in rows):
            problems.append(f'the article list shows {rows}')
    return problems


def case_p11(page, base, port):
    problems = []
    for scheme, forced in [('light', False), ('dark', False), ('light', True)]:
        page.emulate_media(color_scheme=scheme, forced_colors='active' if forced else 'none')
        page.goto(base + '?with=seneca#article-6', wait_until='networkidle')
        page.wait_for_selector('#article-6 .pt.second')
        where = f'{scheme}{" forced colours" if forced else ""}'
        words = span(page, 6, 'all of them work toward one end').first
        words.scroll_into_view_if_needed()
        words.click(timeout=5000)
        card = page.locator('#article-6 li.claim').filter(has_text='Every part of the world').first
        listing = card.locator('.picked')
        if not listing.count():
            problems.append(f'{where}: picking words shows no “Sources for the selected words”')
            continue
        text = listing.text_content()
        for need in ['Sources for the selected words', '6.38', '4.19', 'Seneca', 'Show the quotes']:
            if need not in text:
                problems.append(f'{where}: the source list lacks “{need}”')
        problems += [f'{where}: {p}' for p in agree(page, 6)]
        size = words.evaluate("n => getComputedStyle(n).backgroundSize")
        if not forced and '2px' in size:
            problems.append(f'{where}: lines are still 2 px ({size})')
        # Found by the reader task: at 1440 the 1 px samples of 6.38 and 4.19 looked the same; each Marcus source needs its own visible colour.
        marks = listing.locator('li[data-ref]:not([data-ref^="Ep."]) .dot')
        tints = [m.evaluate("n => getComputedStyle(n).backgroundColor") for m in marks.all()]
        if not forced and (len(tints) < 2 or len(set(tints)) != len(tints)):
            problems.append(f'{where}: Marcus\'s sources in the list do not show distinct colours ({tints})')
        # Found by the reader task: in forced colours the picked words were not marked at all.
        if forced and words.evaluate("n => getComputedStyle(n).outlineStyle") in ('none', ''):
            problems.append(f'{where}: the picked words carry no mark in forced colours')
        # G7: under each added author's passage in the quotes, the sentence on its context (or that it awaits review).
        listing.locator('.show').click(timeout=5000)
        seneca_rows = card.locator('.pair[data-ref^="Ep."]')
        if not seneca_rows.count() or not all('context' in row.locator('.said').text_content().lower() for row in seneca_rows.all()):
            problems.append(f'{where}: Seneca\'s quoted passage shows no context line')
        heads = card.locator('.cols').all_text_contents()
        if any('Marcus' in h for h in heads):
            problems.append(f'{where}: the column over Seneca\'s quotes is headed “{heads[0]}”')
        joint = page.locator('#article-6 li.claim .sg.join').filter(has_text=re.compile(r'^[;,]?\s*yet$')).first   # the editor's “; yet”
        joint.click(timeout=5000)
        if "The editor's connection" not in card.locator('.picked').text_content().replace('’', "'"):
            problems.append(f'{where}: picking the joining word “yet” does not say it is the editor\'s connection')
    return problems


def case_p12(page, base, port):
    problems = []
    sim(page, base, port, '?with=seneca')
    switch(page, 'The life within')
    if shown(page) != [4, 5, 6]:
        problems.append(f'picker: {shown(page)}')
    page.locator('#article-6 li.claim .show').first.click()
    link = page.locator('#article-6 .near a', has_text='What happens to me').first
    link.scroll_into_view_if_needed()
    link.click()
    page.wait_for_timeout(1200)
    if shown(page) != [1, 2, 3]:
        problems.append(f'a neighbour link into chapter 1 shows {shown(page)}')
    top = page.evaluate("document.getElementById('article-3') ? Math.round(document.getElementById('article-3').getBoundingClientRect().top) : null")
    if top is None or not -5 <= top <= 120:
        problems.append(f'Article 3 is not brought into view (top {top})')
    if 'with=seneca' not in page.url or not page.locator('.sg.add').count():
        problems.append('Seneca was switched off by moving chapter')
    if 'at=' in page.url:
        problems.append('the open panel of the other chapter stayed selected')
    page.go_back()
    page.wait_for_timeout(700)
    if shown(page) != [4, 5, 6]:
        problems.append(f'Back after the neighbour link shows {shown(page)}')
    for query, want in [('?at=5.c1', 5), ('#article-6', 6)]:
        page.goto(base + query, wait_until='networkidle')
        page.wait_for_timeout(400)
        if want not in shown(page):
            problems.append(f'{query} shows {shown(page)}')
    return problems


CASES = {
    'P1': ('selection stays on its words across a voice switch', case_p1, (1440, 1000)),
    'P2': ('counts and strikes after removing passages', case_p2, (1440, 1000)),
    'P3': ('a verdict the browser refuses to save', case_p3, (390, 844)),
    'P4': ('Back and Forward across chapters', case_p4, (390, 844)),
    'P5': ('a typed #article-N in another chapter', case_p5, (1440, 1000)),
    'P6': ('the chapter heading after a switch', case_p6, (390, 844)),
    'P7': ('removals in another chapter stay in the link', case_p7, (1440, 1000)),
    'P8': ('a chapter file that does not match, fails, or cannot be drawn', case_p8, (1440, 1000)),
    'P9': ('the topic tree opens the chapter on screen', case_p9, (1440, 1000)),
    'P10': ('the phone bar fits at 360 px', case_p10, (360, 740)),
    'P11': ('source list for picked words; editor\'s words; thin lines', case_p11, (390, 844)),
    'P12': ('two-chapter simulation: picker, neighbour link, Back, deep links', case_p12, (1440, 1000)),
}


def run_cases(browser, base: str, port: int, names: list[str]) -> int:
    failures = 0
    for name in names:
        title, fn, (width, height) = CASES[name]
        ctx = browser.new_context(viewport={'width': width, 'height': height})
        page = ctx.new_page()
        errors: list[str] = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        try:
            problems = fn(page, base, port)
        except Exception as error:   # a case that cannot run is a failure, with the reason
            problems = [f'could not run: {str(error).splitlines()[0][:200]}']
        if errors and name != 'P8':
            problems.append(f'page errors {errors[:2]}')
        failures += bool(problems)
        print(f"{'ok  ' if not problems else 'FAIL'} {name:4} {title}" + ('' if not problems else ' · ' + '; '.join(problems)))
        ctx.close()
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3170)
    parser.add_argument('--quick', action='store_true', help='skip the hover sweep')
    parser.add_argument('--cases', default='', help='comma-separated case names; runs only these, without the sweep')
    parser.add_argument('--no-cases', action='store_true', help='run only the sweep')
    args = parser.parse_args()
    base = f'http://localhost:{args.port}/apps/stoic-constitution.html'
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        if args.cases:
            failures = run_cases(browser, base, args.port, [c.strip().upper() for c in args.cases.split(',')])
            browser.close()
            print('all cases pass' if not failures else f'{failures} case(s) failed')
            return 1 if failures else 0
        for chapter, numbers in chapters(args.port):
            for query in ['', 'with=seneca']:
                for width, height, scheme in SIZES:
                    params = '&'.join(x for x in [f'c={chapter}' if chapter else '', query] if x)
                    url = base + ('?' + params if params else '')
                    ctx = browser.new_context(viewport={'width': width, 'height': height}, color_scheme=scheme)
                    page = ctx.new_page()
                    errors: list[str] = []
                    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    page.goto(url, wait_until='networkidle')
                    page.wait_for_selector(f'#article-{numbers[-1]} .statement', timeout=15000)
                    buttons = page.locator('li.claim .show')
                    for i in range(0, buttons.count(), 3):
                        buttons.nth(i).click()
                    m = page.evaluate(MEASURE)
                    problems = []
                    if m['overflow'] != 0:
                        problems.append(f"overflow {m['overflow']}px")
                    if m['small']:
                        problems.append(f"small text {m['small']}")
                    if m['short']:
                        problems.append(f"short buttons {m['short']}")
                    if sorted(m['articles']) != sorted(f'article-{n}' for n in numbers):
                        problems.append(f"articles drawn {m['articles']}, expected {numbers}")
                    if width >= 1000:
                        for row in page.evaluate(LAYOUT):
                            if abs(row['gap']) > 40:
                                problems.append(f"{row['id']}: sides start {row['gap']}px from the statement column")
                        for n in numbers:
                            page.evaluate(f"scrollTo({{top: document.querySelector('#article-{n} .grps').getBoundingClientRect().top + scrollY + 200, behavior: 'instant'}})")
                            page.wait_for_timeout(60)
                            box = page.evaluate(f"(() => {{ const r = document.querySelector('#article-{n} .sci').getBoundingClientRect(); return [r.top, r.bottom]; }})()")
                            if box[1] < 100 or box[0] > height - 100:
                                problems.append(f'article-{n}: the vectors column is off screen beside the sides')
                        if not args.quick:
                            page.mouse.move(1, 1)
                            for selector in ['.sg[data-refs]', 'svg.map .pt']:
                                items = page.locator(selector)
                                for i in range(items.count()):
                                    item = items.nth(i)
                                    item.scroll_into_view_if_needed()
                                    item.hover(force=True)
                            page.mouse.move(1, 1)
                    if errors:
                        problems.append(f'errors {errors[:3]}')
                    status = 'ok  ' if not problems else 'FAIL'
                    failures += bool(problems)
                    print(f"{status} {width}×{height} {scheme:5} {params or '(no query)':28} articles {len(m['articles'])}" + ('' if not problems else ' · ' + '; '.join(problems)))
                    ctx.close()
        if not args.no_cases:
            failures += run_cases(browser, base, args.port, list(CASES))
        browser.close()
    print('all checks pass' if not failures else f'{failures} run(s) or case(s) failed')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
