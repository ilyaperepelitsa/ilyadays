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

Then it runs named cases (rows P1 to P12 of plan/stoicism/34-after-review-plan.md, and P13 to P16 from the second look
at that milestone), each a scenario that once failed on the page. The cases run on a frozen record
(tests/aurelius/fixtures/constitution-page-cases.json, built by the real build and served in place of the published
files), so rewriting an article cannot break them: a selection that must stay on its words across a voice switch, honest counts after removing
passages, a verdict that cannot be saved, chapter navigation in a simulated second chapter (Articles 4 to 6 served
as chapter c3), a chapter file that does not match the index, the phone bar, and the source list for picked words.
  --cases P1,P4   run only these cases (and no sweep)      --no-cases   run only the sweep
"""
import argparse
import copy
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(360, 740, 'dark'), (390, 844, 'light'), (1440, 1000, 'light')]
# The named cases run on a frozen record, built by the real build, so that rewriting an article cannot break a page case.
FIXTURE = ROOT / 'tests/aurelius/fixtures/constitution-page-cases.json'
FIX: dict = {}


def build_fixture() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        done = subprocess.run([sys.executable, str(ROOT / 'scripts/aurelius-constitution.py'), '--authored', str(FIXTURE), '--out-dir', tmp], capture_output=True, text=True, cwd=ROOT)
        if done.returncode:
            raise SystemExit('the fixture record does not build: ' + (done.stderr.strip().splitlines() or ['?'])[-1])
        FIX['index'] = json.loads((Path(tmp) / 'stoic-constitution.json').read_text())
        FIX['chapters'] = {path.stem: json.loads(path.read_text()) for path in (Path(tmp) / 'stoic-constitution').glob('*.json')}


def serve_fixture(ctx) -> None:
    ctx.route('**/apps/stoic-constitution.json', lambda route: route.fulfill(json=FIX['index']))
    ctx.route('**/apps/stoic-constitution/*.json', lambda route: route.fulfill(json=FIX['chapters'][route.request.url.rsplit('/', 1)[1].split('.')[0]])
              if route.request.url.rsplit('/', 1)[1].split('.')[0] in FIX['chapters'] else route.fulfill(status=404, body='no such chapter'))

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
    index = copy.deepcopy(FIX['index'])
    full = copy.deepcopy(FIX['chapters']['c6'])['articles']
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
    full = copy.deepcopy(FIX['chapters']['c6'])
    # a) a chapter file that lacks an article the index lists
    serve(page, None, {'c6': {'chapter': 'c6', 'articles': full['articles'][:5]}})
    page.goto(base, wait_until='networkidle')
    page.wait_for_timeout(500)
    text = page.locator('#list').text_content()
    if 'out of date' not in text or 'Reload' not in text or shown(page):   # a file out of step with the index: say so and offer a reload (R2)
        problems.append(f'a chapter file without Article 6 draws {shown(page)} and says “{text[:80]}”')
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


# ---- cases from the second look at milestone N1 (plan/stoicism/35-completion-log.md, rows R1 to R4)
def case_p13(page, base, port):
    """An in-page link (Topics) must not redraw the chapter or drop the picked words."""
    problems = []
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    words = page.locator('#article-6 li.claim .sg:not(.join)').first
    words.scroll_into_view_if_needed()
    words.click(timeout=5000)
    text = picked(page, 6)
    page.evaluate("() => { window.__card = document.getElementById('article-6'); }")
    page.locator('#jump a[href="#topics"]').click()
    page.wait_for_timeout(700)
    if not page.evaluate("() => window.__card === document.getElementById('article-6')"):
        problems.append('a tap on Topics redrew the chapter')
    if picked(page, 6) != text or not page.locator('#article-6 .picked').count():
        problems.append(f'a tap on Topics dropped the picked words {text}')
    page.go_back()
    page.wait_for_timeout(700)
    if picked(page, 6) != text:
        problems.append(f'Back from Topics dropped the picked words {text}')
    return problems


def case_p14(page, base, port):
    """A chapter file that holds an article the index does not list: the reader must be able to get out by reloading."""
    problems = []
    state = {'stale': True, 'index': 0}
    def chapter(route):
        data = copy.deepcopy(FIX['chapters'][route.request.url.rsplit('/', 1)[1].split('.')[0]])
        if state['stale']:
            data['articles'] = data['articles'] + [dict(data['articles'][-1], number=data['articles'][-1]['number'] + 1)]
        route.fulfill(json=data)
    def index(route):
        state['index'] += 1
        route.fallback()
    page.route('**/stoic-constitution/*.json', chapter)
    page.route('**/apps/stoic-constitution.json', index)
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('#list .loading')
    said = page.locator('#list').inner_text()
    if 'reload' not in said.lower():
        problems.append(f'a newer chapter file than the index does not tell the reader to reload: “{said[:120]}”')
    button = page.locator('#list button')
    if button.count() and 'reload' in button.first.inner_text().lower():
        state['stale'] = False
        before = state['index']
        button.first.click()
        try:
            page.wait_for_selector('article.article .statement', timeout=8000)
        except Exception:
            problems.append('after Reload the chapter is still not drawn')
        if state['index'] <= before:
            problems.append('Reload did not fetch the index again')
    else:
        problems.append(f'the button offered is “{button.first.inner_text() if button.count() else "none"}”, which fetches the same file again')
    return problems


def case_p15(page, base, port):
    """The statement counts its surviving passages as the claims do."""
    problems = []
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    refs = page.evaluate("() => [...document.querySelectorAll('#article-6 .statement .fused span')].map(n => n.textContent.trim()).filter(Boolean)")
    head = lambda: page.locator('#article-6 .statement .fused b').first.text_content()
    page.goto(base + f'?without=6:{refs[0]}#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    want = f'{len(refs) - 1} of {len(refs)} passages remain for this statement'
    if want not in head():
        problems.append(f'{refs[0]} removed: the statement says “{head()}”, not “{want}”')
    page.goto(base + f'?without=6:{",".join(refs)}#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    if 'No passage left' not in head():
        problems.append(f'all of {refs} removed: the statement says “{head()}”')
    page.goto(base + f'?with=seneca&without=6:{",".join(refs)}#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    if page.locator('#article-6 .statement .sg.add').count() and 'what remains is Seneca' not in head():
        problems.append(f'all removed with Seneca on: the statement says “{head()}” although Seneca\'s clause remains')
    return problems


def case_p16(page, base, port):
    """At the top of the page on a phone, the article list and the chapter list open where they can be seen and tapped."""
    problems = []
    for button, panel in [('.art-btn', '#article-list'), ('.chap-btn', '#chapters')]:
        page.goto(base, wait_until='networkidle')
        page.wait_for_selector('#article-6 .statement')
        page.evaluate('scrollTo(0, 0)')
        page.locator(button).click()
        page.wait_for_timeout(500)
        seen = page.evaluate("""sel => { const rows = [...document.querySelectorAll(sel + ' button')]; return rows.map(row => { const r = row.getBoundingClientRect();
            const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= innerHeight && Boolean(at && at.closest(sel)); }); }""", panel)
        if not seen or not seen[0]:
            problems.append(f'{panel}: its first row cannot be seen or tapped when opened at the top of the page')
        elif not all(seen[:6]):
            problems.append(f'{panel}: rows hidden or covered: {[i + 1 for i, ok in enumerate(seen[:6]) if not ok]}')
        page.keyboard.press('Escape')
    return problems


def case_p17(page, base, port):
    """A recorded inference of the editor's (the fixture's “so” in Article 6's statement) is named as one, with its reason."""
    problems = []
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    joint = page.locator('#article-6 .statement .sg.join').filter(has_text=re.compile(r'(^|[^a-z])so$')).first
    joint.scroll_into_view_if_needed()
    joint.click(timeout=5000)
    said = page.locator('#article-6 .statement .picked').text_content().replace('’', "'") if page.locator('#article-6 .statement .picked').count() else ''
    if "The editor's inference" not in said:
        problems.append(f'picking “so” says “{said[:90]}”, not that it is the editor\'s inference')
    if 'the step from what is sent' not in said:
        problems.append('the reason recorded for the inference is not shown')
    return problems


def case_t6(page, base, port):
    """The translation page: every translated passage under its section, one version at a time on a phone, three side by side on a wide screen."""
    problems = []
    url = base.replace('stoic-constitution.html', 'stoic-translation.html')
    page.goto(url, wait_until='networkidle')
    page.wait_for_selector('article.passage')
    visible = lambda: page.evaluate("[...document.querySelector('article.passage').querySelectorAll('.col')].filter(n => n.offsetParent).map(n => n.className.replace('col ', ''))")
    data = json.loads((ROOT / 'public/apps/stoic-translation.json').read_text())
    measure = lambda: page.evaluate("""() => ({n: document.querySelectorAll('article.passage').length, sections: document.querySelectorAll('header.sec').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: [...document.querySelectorAll('body *')].filter(n => n.children.length === 0 && n.textContent.trim() && n.offsetParent && parseFloat(getComputedStyle(n).fontSize) < 12).length,
        short: [...document.querySelectorAll('button')].filter(n => n.offsetParent && n.getBoundingClientRect().height < 40).length})""")
    seen = measure()
    if seen != {'n': len(data['passages']), 'sections': len(data['sections']), 'overflow': 0, 'small': 0, 'short': 0}:
        problems.append(f'phone: {seen}')
    for passage in data['passages']:
        if page.locator('#p-' + re.sub(r'[^0-9a-z]+', '-', passage['standard_ref'])).count() != 1:
            problems.append(f"no card to link to for Meditations {passage['standard_ref']}")
    parts = [p for p in data['passages'] if p.get('part')]
    if page.locator('article.passage p.part').count() != len(parts):
        problems.append('a passage that is part of a chapter does not say so')
    if len(data['sections']) > 1:
        last = data['sections'][-1]
        page.locator('#toc a').nth(len(data['sections']) - 1).click()
        page.wait_for_timeout(250)
        top = page.locator('#s-' + last['id'].replace('.', '-')).evaluate('n => n.getBoundingClientRect().top')
        if not 0 <= top < 200:
            problems.append(f'the contents link to the last section leaves its heading at y={top:.0f}')
        page.evaluate('scrollTo(0, 0)')
    if visible() != ['en']:
        problems.append(f'phone: opens showing {visible()}, not the new English alone')
    for which, want in [('grc', ['grc']), ('old', ['old']), ('all', ['grc', 'en', 'old'])]:
        page.locator(f'.bar button[data-show={which}]').click()
        if visible() != want:
            problems.append(f'phone: “{which}” shows {visible()}')
    keep = page.locator('article.passage').first.locator('.vb', has_text='Keep')
    keep.click()
    page.reload(wait_until='networkidle')
    page.wait_for_selector('article.passage')
    if page.locator('article.passage').first.locator('.vb[aria-pressed=true]').count() != 1:
        problems.append('a verdict is not kept after a reload')
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.wait_for_timeout(200)
    if visible() != ['grc', 'en', 'old'] or measure()['overflow']:
        problems.append(f'wide: {visible()} {measure()}')
    opened = page.locator('article.passage').first.locator('details.notes')
    if opened.count() != 2:
        problems.append('the notes and the second reading are not both offered')
    return problems


def case_p18(page, base, port):
    """Found by the second cold reader (23 Nov 2026), on a phone: opening another panel must not throw the reader off;
    touching words must not make the text jump; the removal line reads properly and counts said-once items;
    with an added author on, the statement names that author among its sources."""
    problems = []
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    shows = page.locator('#article-6 li.claim .show')
    shows.nth(0).scroll_into_view_if_needed()
    shows.nth(0).click()
    page.wait_for_timeout(300)
    second = page.locator('#article-6 li.claim:not(:has(.trace)) .show').first
    second.scroll_into_view_if_needed()
    key = second.get_attribute('data-k')
    before = second.bounding_box()['y']
    second.click()
    page.wait_for_timeout(400)
    after = page.locator(f'[data-k="{key}"]').bounding_box()
    if after is None or abs(after['y'] - before) > 6:
        problems.append(f'opening a second panel moved the button I tapped from y={before:.0f} to y={after["y"] if after else "nowhere":.0f}')
    # touching a phrase must not change the height of the vectors readout (it sits above the text on a phone)
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    readout = page.locator('#article-6 .readout').first
    idle = readout.bounding_box()['height']
    page.locator('#article-6 li.claim .sg:not(.join)').first.hover()
    page.wait_for_timeout(200)
    busy = readout.bounding_box()['height']
    if abs(idle - busy) > 1:
        problems.append(f'touching a phrase changes the readout from {idle:.0f}px to {busy:.0f}px, so the text below jumps')
    # the removal line
    page.goto(base + '?without=6:4.19,10.22#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    line = page.locator('#article-6 .dropline').first.text_content()
    if not re.search(r'Claims \d(, \d)* and \d now rest on a single passage', line):
        problems.append(f'the removal line reads “{line}”')
    if 'said once' not in line:
        problems.append('the removal line does not mention the said-once sentences that lost their passage')
    # the statement names the added author among its sources
    page.goto(base + '?with=seneca#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    if page.locator('#article-6 .statement .sg.add').count() and 'Seneca' not in page.locator('#article-6 .statement .fused').first.text_content():
        problems.append('the statement carries Seneca’s clause but lists only Marcus’s passages under it')
    return problems

def case_e2(page, base, port):
    """An article that still quotes the 1634 English (run on the real record): each of Marcus's passages offers the
    project's English and the Greek one tap away, says the article is not rewritten on it, and links to a card that exists."""
    problems = []
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('article.article .statement')
    art = page.locator('article.article:not(:has(.from-greek))').first
    art.scroll_into_view_if_needed()
    art.locator('li.claim .show').first.click()
    page.wait_for_timeout(300)
    rows = art.locator('li.claim .pair:not(:has(.in-context))')
    if not rows.count():
        return ['no passage of Marcus is shown under the first claim']
    cards = {'p-' + re.sub(r'[^0-9a-z]+', '-', p['standard_ref']): p for p in json.loads((ROOT / 'public/apps/stoic-translation.json').read_text())['passages']}
    for i in range(rows.count()):
        row = rows.nth(i)
        name = row.locator('.said b').first.text_content()
        more = row.locator('details.versions')
        if more.count() != 1:
            problems.append(f'{name}: the new English is not offered')
            continue
        summary = more.locator('summary')
        if 'today’s English' not in summary.text_content():
            problems.append(f'{name}: the disclosure is called “{summary.text_content()}”')
        summary.evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
        summary.click()
        target = (more.locator('a').get_attribute('href') or '').split('#')[-1]
        passage = cards.get(target)
        if not passage:
            problems.append(f'{name}: links to #{target}, which is not a card on the translation page')
            continue
        shown = more.locator('.ctx.new').text_content()
        if ' '.join(shown.split()) != ' '.join(passage['english'].split()):
            problems.append(f'{name}: the English shown is not the stored translation of {passage["standard_ref"]}')
        if not more.locator('.ctx.grc').is_visible() or 'still quotes the 1634' not in more.text_content():
            problems.append(f'{name}: the Greek, or the line saying the article still quotes 1634, is missing')
        if passage['casaubon_ref'] not in name:
            problems.append(f'{name}: the card it links to is the 1634 passage {passage["casaubon_ref"]}')
    if page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') != 0:
        problems.append('the opened disclosure makes the page scroll sideways')
    return problems


def case_e1(page, base, port):
    """An article quoted from the project's translation (run on the real record): today's English is what is quoted,
    the modern number stands beside Casaubon's, and the Greek and the 1634 English are one tap away."""
    problems = []
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('article.article .statement')
    anchored = page.locator('article.article:has(.from-greek)')
    if not anchored.count():
        return ['no article on the page is quoted from the project translation']
    art = anchored.first
    art.scroll_into_view_if_needed()
    art.locator('li.claim .show').first.click()
    page.wait_for_timeout(300)
    row = art.locator('li.claim .pair').first
    head = row.locator('.said b').first.text_content()
    if 'in modern editions' not in head:
        problems.append(f'the passage is headed “{head}”, without its modern number')
    quoted = row.locator('.ctx mark').first.text_content()
    if re.search(r'\b(thee|thou|doth|unto|hath)\b', row.locator('.ctx').first.text_content()):
        problems.append(f'the quoted passage is still 1634 English: “{quoted[:60]}”')
    more = row.locator('details.versions')
    if not more.count():
        problems.append('the Greek and the 1634 English are not offered under the passage')
    else:
        more.locator('summary').click()
        text = more.text_content()
        if not re.search('[\u0370-\u03ff\u1f00-\u1fff]{4,}', text):
            problems.append('opening it shows no Greek')
        if not re.search(r'\b(thee|thou|doth|unto|hath|is it best)\b', text):
            problems.append('opening it shows no 1634 English')
        link = more.locator('a').first.get_attribute('href')
        if not link or not link.startswith('stoic-translation.html#p-'):
            problems.append(f'the link to the side-by-side page is “{link}”')
    note = art.locator('.tr-note')
    if not note.count() or 'new English' not in note.first.text_content():
        problems.append('the vectors column does not say how the passages sit in the new English')
    if 'In the new English' not in art.locator('li.claim .near').first.text_content():
        problems.append('the claim’s closeness is not given for the new English')
    # Found by the second cold reader: promises and counts that did not match what the page shows.
    if 'beside each passage' in art.locator('.from-greek').first.text_content():
        problems.append('the note under the title promises the modern number “beside each passage”, but the chips show only Casaubon’s')
    row = art.locator('details.member').first
    row.evaluate("n => { for (let p = n; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; }")
    said = len(row.locator('blockquote').first.inner_text().split())
    counted = int(re.search(r'(\d+) words', row.locator('summary').inner_text()).group(1))
    if abs(said - counted) > 2:
        problems.append(f'the section list says {counted} words for a passage shown in {said} words of the new English')
    page.goto(base + '?with=seneca', wait_until='networkidle')
    page.wait_for_selector('article.article .statement')
    art = page.locator('article.article:has(.from-greek)').first
    limited = art.locator('li.claim[data-challenged]')
    for i in range(limited.count()):
        tag = limited.nth(i).locator('.who.inl').first.text_content()
        box = art.locator('.voice, [data-voice]').first
        if 'adds' in tag and 'Limits' in art.inner_text():
            problems.append(f'a clause the page counts under “Limits” is tagged “{tag.strip()}”')
            break
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
    'P13': ('an in-page link keeps the chapter and the picked words', case_p13, (390, 844)),
    'P14': ('a chapter file newer than the index: reload gets out', case_p14, (390, 844)),
    'P15': ('the statement counts its surviving passages', case_p15, (1440, 1000)),
    'P16': ('lists opened at the top of the page on a phone can be seen', case_p16, (390, 844)),
    'P17': ('an editor\'s inference is named, with its reason', case_p17, (390, 844)),
    'P18': ('second cold reader: steady panels, no jump on touch, removal line, statement sources', case_p18, (390, 844)),
    'T6': ('the translation page: every passage under its section, three versions', case_t6, (390, 844)),
    'E1': ('an article quoted from the new English: modern number, Greek and 1634 on request', case_e1, (390, 844), 'real'),
    'E2': ('an article still on the 1634 English: the new English and the Greek on request', case_e2, (390, 844), 'real'),
}


def run_cases(browser, base: str, port: int, names: list[str]) -> int:
    failures = 0
    build_fixture()
    for name in names:
        title, fn, (width, height) = CASES[name][:3]
        ctx = browser.new_context(viewport={'width': width, 'height': height})
        if 'real' not in CASES[name][3:]:   # a few cases look at the real record on purpose
            serve_fixture(ctx)
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
                        # the page now holds a tapped button where it was, so the next one can lie under the Voices dock: bring it to the middle first
                        buttons.nth(i).evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
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
