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
Cases R1 to R4 cover the owner's review tools (W7 of plan/stoicism/32-delegation-plan.md: per-item verdicts and notes kept
across a reload, Copy my review and the file, the filter, the v1 carry-over); M1 and M2 the map (W6.1 marks by effect, W6.3
labels that do not overlap). H1 to H3 cover the shared site header (the React header's links, labels, boxes and colours on all
three Stoic pages, EN and RU, without a layout shift), the "Hide the editor's decisions" switch (off, on, kept across a reload,
storage blocked) and the wide-screen columns (sides in a row share heading, rule and first card within 2 px at 1440 and 1920, EN
and RU, with and without Seneca; the vectors start level with the article's heading).
  --cases P1,P4   run only these cases (and no sweep)      --no-cases   run only the sweep

Last, the Russian edition (skipped, with a message, while public/apps/stoic-constitution.ru.json does not exist): the EN / RU
switch at 390 and 1440 px (the Russian files are read, the choice survives a reload without ?lang, a second chapter opens from
the picker, a claim's quotes open, EN comes back), then every chapter with ?lang=ru at 360, 390 and 1440 px with and without
Seneca: overflow, small text, short buttons, articles drawn, console errors, page words without a Russian, and English left
in the Russian articles.
  --ru-only   only the Russian checks      --no-ru   skip them      --ru-dir DIR   serve a development build (--lang ru --partial --out-dir DIR)
  --shots DIR   save screenshots of the Russian page
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
VERDICT_KEY = 'stoic-constitution:v2:review'   # the owner's review (W7); v1 held article verdicts only and is read once
OLD_VERDICT_KEY = 'stoic-constitution:v1:verdicts'


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


def case_edition_selection(page, base, port):
    """Keep an unchanged selection across editions and clear a saying that disappears."""
    problems = []
    page.goto(base + '?lang=en#article-1')
    page.wait_for_selector('#article-1 .statement')
    card = page.locator('#article-1')
    for phrase, expected in [('a member', {'7.10', '9.21'}), ('of one body', {'7.10', '11.7'})]:
        part = span(page, 1, phrase)
        if part.count() != 1:
            return [f'the revised opening is missing the separate “{phrase}” span']
        refs = set((part.get_attribute('data-refs') or '').split('|'))
        if refs != expected:
            problems.append(f'“{phrase}” has {refs} instead of {expected}')
    span(page, 1, 'a member').click()
    for _ in range(2):
        voice(page)
        if picked(page, 1) != ['a member']:
            problems.append('switching editions cleared or moved “a member”')
        problems.extend(agree(page, 1))
    new_saying = card.locator('.sg[data-k="single-1-11.7i"]')
    new_saying.click()
    voice(page)
    if new_saying.count() or page.evaluate('state.sel !== null'):
        problems.append('switching editions left the selection on a saying absent from that edition')
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
    head = page.evaluate("document.querySelector('#a-head').getBoundingClientRect().top")
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
    problems = [] if open_ == ['The life within'] else [f'the topic tree has {open_} open while chapter 2 is on screen']
    rail = page.evaluate("[...document.querySelectorAll('#rail .rch.on .t')].map(n => n.textContent)")
    if rail != ['The life within']:
        problems.append(f'the contents rail highlights {rail} while chapter 2 is on screen')
    return problems


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
    under = page.evaluate("Math.round(document.querySelector('.bar').getBoundingClientRect().bottom)")   # the site header and the bar stay pinned
    if top is None or not under - 5 <= top <= under + 60:
        problems.append(f'Article 3 is not brought into view under the bar ending at {under}px (top {top})')
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
    # The site header (site-chrome.js) is the site's own, EN · RU pill at 0.68 rem included, so it is not this page's small text.
    measure = lambda: page.evaluate("""() => ({n: document.querySelectorAll('article.passage').length, sections: document.querySelectorAll('header.sec').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: [...document.querySelectorAll('body *')].filter(n => n.children.length === 0 && n.textContent.trim() && n.offsetParent && !n.closest('.site-header') && parseFloat(getComputedStyle(n).fontSize) < 12).length,
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
    for which, want in [('grc', ['grc']), ('old', ['old']), ('ru', ['ru']), ('all', ['grc', 'en', 'old', 'ru'])]:
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
    if visible() != ['grc', 'en', 'old', 'ru'] or measure()['overflow']:
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
    record = json.loads((ROOT / 'content/aurelius/constitution.json').read_text())
    if all(a.get('edition') for a in record['articles']):
        # Every article now quotes the new English, so there is nothing on the 1634 English to look at. That is the
        # intended end state; the page must then show no such article either.
        left = page.locator('article.article:not(:has(.from-greek))').count()
        return [f'{left} article(s) on the page lack the “from the Greek” note, but every article in the record quotes the new English'] if left else []
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


# ---- W7 of plan/stoicism/32-delegation-plan.md: review tools for the owner
def stored_review(page) -> dict:
    return page.evaluate(f"(() => {{ try {{ return JSON.parse(localStorage.getItem('{VERDICT_KEY}')) || {{}}; }} catch {{ return {{}}; }} }})()")


def judge(page, scope: str, verdict: str):
    """Open the verdict button of the item whose node carries data-review (inside `scope`) and choose `verdict`."""
    key = page.locator(scope).first.get_attribute('data-review')
    item = page.locator(f'[data-review="{key}"]').first
    item.locator('.vt').first.evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
    item.locator('.vt').first.click()
    page.locator(f'[data-review="{key}"] .vpick .vb', has_text=verdict).first.click()
    return key


HEADS = """() => [...document.querySelectorAll('li.claim > .card-head, .statement > .card-head')].filter(n => n.offsetParent).map(n => Math.round(n.getBoundingClientRect().height))"""


def case_r1(page, base, port):
    """On a phone: mark one quote's conclusion Revise, type why, reload, and find both kept. The button keeps the card as it was."""
    problems = []
    note = 'The conclusion says more than the quote'
    for query in ['', '?with=seneca']:   # the corner button must not make a card's corner row taller, with or without an added author
        page.goto(base + query + '#article-6', wait_until='networkidle')
        page.wait_for_selector('#article-6 .statement')
        with_button = page.evaluate(HEADS)
        page.add_style_tag(content='.vt{display:none!important}')
        without = page.evaluate(HEADS)
        taller = sum(1 for a, b in zip(with_button, without) if a > b + 1)
        if taller:
            problems.append(f'{query or "Marcus alone"}: the verdict button makes {taller} of {len(without)} corner rows taller')
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    claim = page.locator('#article-6 li.claim').first
    claim.locator('.fused .show').first.click()
    key = judge(page, '#article-6 li.claim .pair[data-review]', 'Revise')
    if not key or not key.startswith('a6:p:'):
        problems.append(f'a quote row of Marcus is keyed “{key}”, not a6:p:<quote id>')
    field = page.locator(f'#article-6 [data-review="{key}"] .vnote').first
    if not field.count():
        return problems + ['choosing Revise shows no note field']
    if not field.evaluate('n => n === document.activeElement'):
        problems.append('after Revise the note field does not take the focus, so the phone keyboard does not open')
    size = field.evaluate("n => [parseFloat(getComputedStyle(n).fontSize), n.getBoundingClientRect().height]")
    if size[0] < 16 or size[1] < 44:
        problems.append(f'the note field is {size[0]}px text and {size[1]:.0f}px tall (needs 16 and 44)')
    field.press_sequentially(note)
    page.wait_for_timeout(700)
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    row = page.locator(f'#article-6 [data-review="{key}"]').first
    if not row.count():   # the link keeps the open panel (?at=); open it only if it is closed
        page.locator('#article-6 li.claim').first.locator('.fused .show').first.click()
    if not row.count():
        return problems + ['after a reload the quote row is gone']
    if row.locator('.vt').first.text_content().strip() != 'Revise':
        problems.append(f'after a reload the button says “{row.locator(".vt").first.text_content().strip()}”')
    kept = row.locator('.vnote').first.input_value() if row.locator('.vnote').count() else None
    if kept != note:
        problems.append(f'after a reload the note reads {kept!r}')
    stored = stored_review(page)
    if stored.get('verdicts', {}).get(key) != 'Revise' or stored.get('notes', {}).get(key) != note:
        problems.append(f'stored under {VERDICT_KEY}: {stored}')
    return problems


def case_r2(page, base, port):
    """“Copy my review” gives plain text with the verdict, the sentence it is about and the note; “Download as a file” gives the same."""
    page.add_init_script("Object.defineProperty(navigator, 'clipboard', {value: {writeText: text => { window.__copied = text; return Promise.resolve(); }}, configurable: true})")
    problems = []
    note = 'Say which body, not just one body'
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    key = judge(page, '#article-6 li.claim[data-review]', 'Drop')
    page.locator(f'#article-6 [data-review="{key}"] .vnote').first.press_sequentially(note)
    sentence = page.evaluate("k => D.articles.find(a => a.number === 6).claims.find(c => 'a6:' + c.id === k).t", key)
    page.locator('#copy').evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
    page.locator('#copy').click()
    page.wait_for_timeout(200)
    text = page.evaluate('window.__copied') or ''
    for need, what in [(note, 'the note'), (' '.join(sentence.split())[:40], 'the sentence it is about'), ('Drop', 'the verdict'), ('Article 6 · ', 'the article heading'), (f'[{key}]', 'the key')]:
        if need not in text:
            problems.append(f'the copied review lacks {what} (“{need}”): {text[:160]!r}')
    if 'Copied' not in page.locator('#copy').text_content():
        problems.append(f'the button says “{page.locator("#copy").text_content()}” after copying')
    with page.expect_download() as info:
        page.locator('#download').click()
    download = info.value
    if not re.fullmatch(r'stoic-review-\d{4}-\d{2}-\d{2}\.txt', download.suggested_filename):
        problems.append(f'the file is called {download.suggested_filename}')
    if note not in Path(download.path()).read_text(encoding='utf-8'):
        problems.append('the downloaded file lacks the note')
    return problems


def case_r3(page, base, port):
    """“Only what I have not judged” hides judged items; one judged while it is on stays until the switch is used again."""
    problems = []
    visible = lambda sel: page.locator(sel).first.is_visible()
    page.goto(base + '#article-6', wait_until='networkidle')
    page.wait_for_selector('#article-6 .statement')
    statement = judge(page, '#article-6 .statement[data-review]', 'Keep')
    claim = judge(page, '#article-6 li.claim[data-review]', 'Revise')
    switch_ = page.locator('#only-open')
    switch_.evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
    switch_.click()
    if switch_.get_attribute('aria-pressed') != 'true':
        problems.append('the switch does not show that it is on')
    for key, what in [(statement, 'the statement'), (claim, 'the judged claim')]:
        if visible(f'[data-review="{key}"]'):
            problems.append(f'{what} is still shown')
    open_ = page.evaluate("[...document.querySelectorAll('#article-6 li.claim')].filter(n => n.offsetParent).map(n => n.dataset.judged || '')")
    if not open_ or any(open_):
        problems.append(f'the claims left in view are {open_} (judged ones must be hidden, the rest shown)')
    if not visible('#filter-note'):
        problems.append('nothing at the top of the articles says that judged items are hidden')
    other = judge(page, '#article-6 li.claim[data-review]:not([data-judged])', 'Keep')
    if not visible(f'[data-review="{other}"]'):
        problems.append('a claim judged while the switch is on vanishes at once, before a note can be typed')
    page.locator('#article-6 .verdict .vb', has_text='Keep').click()
    if not visible('#article-6 .leaf'):
        problems.append('the article judged while the switch is on is folded at once')
    switch_.evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
    switch_.click()
    switch_.click()
    if visible(f'[data-review="{other}"]'):
        problems.append('after the switch is used again, the claim judged meanwhile is still shown')
    if visible('#article-6 .leaf') or not visible('#article-6 .judged-stub') or not visible('#article-6 .verdict'):
        problems.append('a judged article does not fold to one line with its verdict buttons')
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#article-6 .verdict')
    if page.locator('#only-open').get_attribute('aria-pressed') != 'true':
        problems.append('the switch is not kept across a reload')
    page.locator('#show-all').click()
    if not visible(f'[data-review="{statement}"]') or not visible('#article-6 .leaf'):
        problems.append('“Show everything” does not bring the judged items back')
    return problems


def case_r4(page, base, port):
    """The article verdicts of v1 are carried over once into the v2 review."""
    page.add_init_script(f"if (!localStorage.getItem('{VERDICT_KEY}')) localStorage.setItem('{OLD_VERDICT_KEY}', JSON.stringify({{'article-2': 'Drop', 'article-5': 'Keep'}}))")
    problems = []
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('#article-6 .verdict')
    if page.locator('#article-2 .verdict .vb[aria-pressed=true]').all_text_contents() != ['Drop']:
        problems.append('Article 2’s v1 verdict Drop is not shown')
    verdicts = stored_review(page).get('verdicts', {})
    if verdicts.get('a2') != 'Drop' or verdicts.get('a5') != 'Keep':
        problems.append(f'v2 holds {verdicts} after the carry-over')
    page.locator('#article-2 .verdict .vb', has_text='Keep').click()
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#article-6 .verdict')
    if page.locator('#article-2 .verdict .vb[aria-pressed=true]').all_text_contents() != ['Keep']:
        problems.append('v1 is read again after the carry-over and overrides a newer verdict')
    if not re.search(r'Article 2 · .*Keep', page.locator('#mine').text_content()):
        problems.append('the review list does not show Article 2 as Keep')
    return problems


# ---- W6.1 and W6.3: the map of vectors
def expected_effects() -> dict[int, dict[str, str]]:
    """For each article of the fixture, what each quoted passage of Seneca does: the first of Backs, Limits, Adds."""
    out = {}
    for article in FIX['chapters']['c6']['articles']:
        voice = (article.get('voices') or {}).get('seneca')
        if not voice:
            continue
        refs = {}
        for effect in ['stronger', 'qualified', 'wider']:
            for item in voice['items']:
                if item['effect'] == effect:
                    for piece in [item['piece']] if item.get('piece') else item.get('support', []):
                        refs.setdefault(piece['ref'], effect)
        out[article['number']] = {p['ref']: refs.get(p['ref'], 'stronger') for p in voice['passages']}
    return out


def case_m1(page, base, port):
    """An added author's marks say what the passage does, with one key entry for each mark present; ties are darker when closer."""
    problems = []
    page.goto(base + '?with=seneca', wait_until='networkidle')
    page.wait_for_selector('#article-6 .pt.second')
    for number, want in expected_effects().items():
        seen = page.evaluate("""n => [...document.querySelectorAll('#article-' + n + ' svg.map .pt.second')].map(p => {
            const shape = p.querySelector('.mk > :first-child');
            return {ref: p.dataset.ref, effect: p.dataset.effect, fill: shape.getAttribute('fill'), width: shape.getAttribute('stroke-width'), struck: Boolean(p.querySelector('.mk > line'))}; })""", number)
        got = {s['ref']: s['effect'] for s in seen}
        if got != want:
            problems.append(f'Article {number}: marks say {got}, the record says {want}')
        for s in seen:
            look = {'stronger': ('var(--ink)', False), 'wider': ('var(--card)', False), 'qualified': ('var(--card)', True)}[s['effect']]
            if (s['fill'], s['struck']) != look or (s['effect'] != 'stronger' and s['width'] != '2'):
                problems.append(f'Article {number}: {s["ref"]} ({s["effect"]}) is drawn {s}')
        keys = page.evaluate("n => [...document.querySelectorAll('#article-' + n + ' .sci > .key [data-effect]')].map(k => k.dataset.effect)", number)
        if sorted(keys) != sorted(set(want.values())):
            problems.append(f'Article {number}: the key lists {keys} for marks {sorted(set(want.values()))}')
        ties = page.evaluate("n => [...document.querySelectorAll('#article-' + n + ' svg.map .base.second')].map(l => [Number(l.dataset.sim), parseFloat(l.style.getPropertyValue('--o'))])", number)
        if ties:
            low, high = min(ties), max(ties)
            if len({t[0] for t in ties}) > 1 and (abs(low[1] - 0.35) > 0.01 or abs(high[1] - 0.9) > 0.01):
                problems.append(f'Article {number}: tie opacity runs {low[1]} to {high[1]}, not 0.35 to 0.9')
    colour = page.evaluate("getComputedStyle(document.querySelector('#article-6 .sci > .key')).color === getComputedStyle(document.body).color")
    if not colour:
        problems.append('the key under the map is not in ink')
    return problems


LABELS = """n => { const svg = document.querySelector('#article-' + n + ' svg.map'), out = [];
  const texts = [...svg.querySelectorAll('.pt text')].filter(t => parseFloat(getComputedStyle(t).opacity) > 0 && !t.closest('.pt').classList.contains('dim'));
  const boxes = texts.map(t => [t.textContent, t.getBoundingClientRect()]);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, r] = boxes[i], [b, s] = boxes[j], w = Math.min(r.right, s.right) - Math.max(r.left, s.left), h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
    if (w > 0.5 && h > 2) out.push(a + ' and ' + b);
  }
  return {shown: texts.length, marcus: svg.querySelectorAll('.pt:not(.second)').length, overlaps: out}; }"""


def case_m2(page, base, port):
    """No visible map label overlaps another, at 390 and 1440 px, with and without an added author; a hidden label shows on hover."""
    problems = []
    for width in [390, 1440]:
        page.set_viewport_size({'width': width, 'height': 900})
        for query in ['', '?with=seneca']:
            page.goto(base + query, wait_until='networkidle')
            page.wait_for_selector('#article-6 .statement')
            page.mouse.move(1, 1)
            for number in shown(page):
                seen = page.evaluate(LABELS, number)
                where = f'{width}px {query or "Marcus alone"}, Article {number}'
                if seen['overlaps']:
                    problems.append(f'{where}: labels overlap: {seen["overlaps"][:4]}')
                if seen['shown'] < seen['marcus'] / 2:
                    problems.append(f'{where}: only {seen["shown"]} of {seen["marcus"]} labels are shown')
        crowded = page.locator('svg.map .pt.crowded:not(.second)')
        if crowded.count():
            crowded.first.scroll_into_view_if_needed()
            crowded.first.hover(force=True)
            if crowded.first.locator('text').evaluate('t => getComputedStyle(t).opacity') != '1':
                problems.append(f'{width}px: a label without a free place does not show when its mark is pointed at')
            page.mouse.move(1, 1)
    return problems


# ---------- the site header, the reading switch and the columns (plan: shared chrome and polish, 2026-11-24) ----------
# The static Stoic pages draw the site header with public/apps/site-chrome.js and site-chrome.css; tests/site/static-chrome.test.mjs
# checks its links and labels against SiteHeader.tsx. Here: it is drawn first, looks like the React header box for box, and does not move.
HEADER = """() => {
  const h = document.querySelector('.site-header');
  if (!h) return null;
  const box = n => { const r = n.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  return {first: document.body.firstElementChild === h, height: box(h)[3], brand: [h.querySelector('.brand').getAttribute('href'), box(h.querySelector('.brand')).slice(0, 2)],
    links: [...h.querySelectorAll('.site-primary-nav a')].map(a => ({href: a.getAttribute('href'), text: a.textContent.trim(), current: a.getAttribute('aria-current'), box: box(a)})),
    on: (h.querySelector('.lang [aria-current=true]') || {}).textContent || null, font: getComputedStyle(h.querySelector('.site-primary-nav a')).fontFamily.split(',')[0].replace(/"/g, ''),
    bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color, old: Boolean(document.querySelector('.wrap.top')),
    shifted: (window.__shifts || []).filter(node => node && node.closest && node.closest('.site-header')).length};
}"""
# Layout shifts, collected from the first paint: a header that moves (late styles, a late language) shows up here.
SHIFTS = """window.__shifts = [];
try { new PerformanceObserver(list => { for (const e of list.getEntries()) for (const s of e.sources || []) window.__shifts.push(s.node); }).observe({type: 'layout-shift', buffered: true}); } catch (e) {}"""


def case_h1(page, base, port):
    """The header on the three Stoic pages, EN and RU, at 390 dark and 1440 light: the React header's boxes, labels and colours."""
    problems = []
    browser = page.context.browser
    site = f'http://localhost:{port}'
    for width, height, scheme in [(390, 844, 'dark'), (1440, 900, 'light')]:
        for lang in ['en', 'ru']:
            ctx = browser.new_context(viewport={'width': width, 'height': height}, color_scheme=scheme)
            ctx.add_init_script(SHIFTS)
            ref_page = ctx.new_page()
            ref_page.goto(site + ('/ru' if lang == 'ru' else '') + '/fitness', wait_until='networkidle')
            ref_page.evaluate('document.fonts.ready')
            # No public React page has Stoicism current (it is this static page), so mark it there as SiteHeader would.
            ref_page.evaluate("() => { for (const a of document.querySelectorAll('.site-primary-nav a')) a.toggleAttribute('aria-current', a.classList.contains('nav-stoicism')); "
                              "document.querySelector('.nav-stoicism').setAttribute('aria-current', 'page'); }")
            ref = ref_page.evaluate(HEADER)
            ref_page.close()
            for name in ['stoic-constitution.html', 'stoic-translation.html', 'stoic-composition.html']:
                where = f'{width}px {lang} {name}'
                p = ctx.new_page()
                p.goto(f'{site}/apps/{name}?lang={lang}', wait_until='networkidle')
                p.evaluate('document.fonts.ready')
                got = p.evaluate(HEADER)
                p.close()
                if not got:
                    problems.append(f'{where}: no site header')
                    continue
                if not got['first'] or got['old']:
                    problems.append(f"{where}: the header is not first in <body> or the old top bar is still there")
                if got['font'] != 'Manrope' or got['bg'] != ref['bg'] or got['ink'] != ref['ink']:
                    problems.append(f"{where}: font {got['font']}, colours {got['bg']} / {got['ink']}, the site has {ref['bg']} / {ref['ink']}")
                if abs(got['height'] - ref['height']) > 1 or got['brand'][0] != ref['brand'][0] or got['brand'][1] != ref['brand'][1]:
                    problems.append(f"{where}: header {got['height']}px, brand {got['brand']}; the site's {ref['height']}px, {ref['brand']}")
                stoic = f'/apps/stoic-constitution.html?lang={lang}'
                want = [(link['text'], link['href'], 'page' if link['href'] == stoic else None) for link in ref['links']]
                if [(link['text'], link['href'], link['current']) for link in got['links']] != want:
                    problems.append(f"{where}: links {[(l['text'], l['href'], l['current']) for l in got['links']]}, expected {want}")
                for mine, theirs in zip(got['links'], ref['links']):
                    if any(abs(a - b) > 1 for a, b in zip(mine['box'], theirs['box'])):
                        problems.append(f"{where}: {mine['text']} at {mine['box']}, the site's at {theirs['box']}")
                        break
                if got['on'] != lang.upper():
                    problems.append(f"{where}: the pill marks {got['on']}")
                if got['shifted']:
                    problems.append(f"{where}: the header moved after the first paint")
            ctx.close()
    return problems


VISIBLE = "sel => [...document.querySelectorAll(sel)].filter(n => n.getClientRects().length > 0).length"
EDITORIAL = ['.hand', '.process', '.statement > .form', '.link.ed', '.vt', '.article > .verdict']
READING = ['.statement .sent', 'li.claim .sent', '.trace .link.pair', 'li.claim .fused']


SHOW_ALL = ("for (const k of ['stoic-constitution:editor', 'stoic-constitution:v1:tags', 'stoic-constitution:review-open']) "
            "try { if (localStorage.getItem(k) === null) localStorage.setItem(k, 'on'); } catch {}")
# The review is drawn only for the site's admin signed in on this browser: the marker AuthProvider.tsx keeps, matching a
# supabase-js session. Contexts get this stand-in owner unless a case asks for a reader (owner=False). No real token.
OWNER_ID = 'check-owner'
AS_OWNER = ("try { if (localStorage.getItem('ilyadays-admin') === null) { localStorage.setItem('ilyadays-admin', '%s'); "
            "localStorage.setItem('ilyadays-auth:check.local', JSON.stringify({access_token: 'x', refresh_token: 'y', expires_at: 1, user: {id: '%s'}})); } } catch {}"
            % (OWNER_ID, OWNER_ID))


def case_o1(page, base, port):
    """The review is the owner's (owner, 24 Nov 2026): a reader, an account that is not the admin, or a signed-out owner sees
    no review section, no Verdict buttons and no filter, even with Editor's decisions on, but keeps the method link; the
    signed-in admin gets one folded row at the end that opens, and stays open across a reload."""
    problems = []
    browser = page.context.browser
    shown = "sel => [...document.querySelectorAll(sel)].filter(n => n.getClientRects().length > 0).length"
    readers = {
        'a reader': "",
        'another account': "localStorage.setItem('ilyadays-admin', 'someone'); localStorage.setItem('ilyadays-auth:x', JSON.stringify({refresh_token: 'y', user: {id: 'other'}}));",
        'the owner signed out': "localStorage.setItem('ilyadays-admin', 'someone');",
    }
    for who, setup in readers.items():
        for lang in ['en', 'ru']:
            ctx = browser.new_context(viewport={'width': 390, 'height': 844}, owner=False)
            ctx.add_init_script("try { %s localStorage.setItem('stoic-constitution:v2:only-open', 'on'); } catch {}" % setup)
            p = ctx.new_page()
            p.goto(f'{base}?lang={lang}', wait_until='networkidle')
            p.wait_for_selector('article.article .statement')
            for sel in ['#yours', '#copy', '.vt', '.article > .verdict', '#filter-note']:
                if p.evaluate(shown, sel):
                    problems.append(f'{who} ({lang}) sees {sel}')
            if p.evaluate("document.body.classList.contains('only-open')"):
                problems.append(f'{who} ({lang}): a stored “only what I have not judged” still filters the page')
            if not p.locator('#more a[href^="stoic-method.html"]').is_visible():
                problems.append(f'{who} ({lang}): the link to the method is gone with the review')
            ctx.close()
    for width in [390, 1440]:
        ctx = browser.new_context(viewport={'width': width, 'height': 900}, defaults=True)
        p = ctx.new_page()
        p.goto(base, wait_until='networkidle')
        p.wait_for_selector('article.article .statement')
        box = p.locator('#yours')
        summary = box.locator('summary')
        summary.scroll_into_view_if_needed()
        if box.evaluate('n => n.open'):
            problems.append(f'{width}px: the owner\'s review starts open')
        height = summary.bounding_box()['height']
        if not summary.is_visible() or height > 64:
            problems.append(f'{width}px: the folded review is {height:.0f}px tall, or hidden')
        if 'Nothing judged yet' not in summary.inner_text():
            problems.append(f'{width}px: the folded row does not say how much is judged: “{summary.inner_text()}”')
        summary.click()
        if not p.locator('#copy').is_visible():
            problems.append(f'{width}px: opening the review does not show its tools')
        p.wait_for_function("localStorage.getItem('stoic-constitution:review-open') === 'on'", timeout=3000)   # toggle fires a task later
        p.reload(wait_until='networkidle')
        if not p.locator('#yours').evaluate('n => n.open'):
            problems.append(f'{width}px: the review closes again after a reload')
        p.locator('#editor-sw').click()
        if not p.evaluate(shown, '.vt'):
            problems.append(f'{width}px: the owner gets no Verdict buttons with Editor\'s decisions on')
        if p.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth'):
            problems.append(f'{width}px: the page scrolls sideways')
        ctx.close()
    return problems


def case_h2(page, base, port):
    """The bar's switches, Sources and Editor's decisions: both off by default on a fresh browser; Editor on shows the
    apparatus, kept across a reload; off again hides it; Sources on puts passage numbers in the text; a link to the method
    page sits next to them; in Russian and with storage blocked the switches still work for the visit."""
    problems = []
    ctx = page.context.browser.new_context(viewport={'width': 1440, 'height': 1000}, defaults=True)
    page = ctx.new_page()
    seen = lambda: {sel: page.evaluate(VISIBLE, sel) for sel in EDITORIAL + READING}
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('#article-1 .statement')
    editor, sources = page.locator('#editor-sw'), page.locator('#sources-sw')
    method = page.locator('.bar a.to-method')
    if editor.get_attribute('aria-checked') != 'false' or sources.get_attribute('aria-checked') != 'false':
        problems.append(f"fresh browser: editor {editor.get_attribute('aria-checked')}, sources {sources.get_attribute('aria-checked')} (both should be off)")
    if not method.count() or 'stoic-method.html' not in (method.get_attribute('href') or ''):
        problems.append('no link to the method page in the bar')
    show = page.locator('#article-1 li.claim .show').first
    show.evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
    show.click()
    page.wait_for_selector('#article-1 li.claim .trace')
    hidden = seen()
    if any(hidden[sel] for sel in EDITORIAL) or not all(hidden[sel] for sel in READING):
        problems.append(f'off by default should hide the apparatus and keep the reading: {hidden}')
    if page.evaluate(VISIBLE, '#article-1 .statement sup, #article-1 .statement .tag'):
        problems.append('Sources off, yet passage numbers show in the statement')
    editor.click()
    shown = seen()
    if not all(shown[sel] for sel in ['.hand', '.process', '.vt', '.article > .verdict']) or page.evaluate("localStorage.getItem('stoic-constitution:editor')") != 'on':
        problems.append(f'editor on: {shown}')
    page.reload(wait_until='networkidle')
    page.wait_for_selector('#article-1 .statement')
    if editor.get_attribute('aria-checked') != 'true' or not page.evaluate(VISIBLE, '.hand'):
        problems.append('after a reload the editor switch did not stay on')
    editor.click()
    if page.evaluate("localStorage.getItem('stoic-constitution:editor')") != 'off' or page.evaluate(VISIBLE, '.hand'):
        problems.append('editor off again did not hide the decisions')
    sources.click()
    if sources.get_attribute('aria-checked') != 'true' or page.evaluate("localStorage.getItem('stoic-constitution:v1:tags')") != 'on':
        problems.append('Sources on did not switch or was not kept')
    ctx.close()
    # In Russian, and with storage blocked: the switches still work for the visit, without an error.
    ctx = page.context.browser.new_context(viewport={'width': 390, 'height': 844}, defaults=True)
    ctx.add_init_script("Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocked', 'SecurityError'); }});")
    blocked = ctx.new_page()
    errors: list[str] = []
    blocked.on('pageerror', lambda e: errors.append(str(e)))
    blocked.goto(base + '?lang=ru', wait_until='networkidle')
    blocked.wait_for_selector('#article-1 .statement')
    label = blocked.locator('#editor-sw').get_attribute('aria-label')
    before = blocked.evaluate(VISIBLE, '.hand')
    blocked.locator('#editor-sw').click()
    if not label.startswith('Показывать') or before or not blocked.evaluate(VISIBLE, '.hand') or errors:
        problems.append(f'Russian with storage blocked: label {label!r}, hidden first {not before}, shown after {blocked.evaluate(VISIBLE, ".hand")}, errors {errors[:2]}')
    ctx.close()
    return problems


ALIGN = """() => [...document.querySelectorAll('article.article')].map(a => {
  const top = n => n ? Math.round(n.getBoundingClientRect().top) : null, bottom = n => n ? Math.round(n.getBoundingClientRect().bottom) : null;
  const sides = {};
  for (const g of a.querySelectorAll('.grps > .grp')) sides[g.dataset.g] = {head: top(g.querySelector('.grp-head')), rule: bottom(g.querySelector('.grp-head')), first: top(g.querySelector('.grp-body > *'))};
  return {id: a.id, sides, sci: top(a.querySelector('.sci')), lead: top(a.querySelector('.lead-col')), statement: top(a.querySelector('.statement'))};
})"""


def case_h3(page, base, port):
    """Wide screens: the sides that share a row share a top line (heading, rule, first card) within 2 px, EN and RU, with and without
    Seneca; the vectors start level with the article's heading, above the statement."""
    problems = []
    rows = {1440: [['why', 'action', 'practice'], ['breaks', 'doubt']], 1920: [['why', 'action', 'practice', 'breaks', 'doubt']]}
    for width, want in rows.items():
        page.set_viewport_size({'width': width, 'height': 1000})
        for lang in ['en', 'ru']:
            for query in ['', '&with=seneca']:
                where = f"{width}px {lang}{' Seneca' if query else ''}"
                page.goto(f'{base}?lang={lang}{query}', wait_until='networkidle')
                page.wait_for_selector('article.article .statement')
                for n in page.evaluate("[...document.querySelectorAll('article.article')].map(a => a.id)"):
                    # The article's top in view, below the sticky bar, so the vectors are not yet held by it.
                    page.evaluate(f"scrollTo({{top: document.getElementById('{n}').getBoundingClientRect().top + scrollY - 120, behavior: 'instant'}})")
                    art = next(a for a in page.evaluate(ALIGN) if a['id'] == n)
                    for row in want:
                        for part in ['head', 'rule', 'first']:
                            values = [art['sides'][g][part] for g in row if g in art['sides'] and art['sides'][g][part] is not None]
                            if len(values) > 1 and max(values) - min(values) > 2:
                                problems.append(f"{where} {n}: {part} of {'/'.join(row)} differ by {max(values) - min(values)}px")
                    if abs(art['sci'] - art['lead']) > 2 or art['sci'] > art['statement'] - 20:
                        problems.append(f"{where} {n}: the vectors start at {art['sci']}, the heading at {art['lead']}, the statement at {art['statement']}")
    return problems[:8]


def case_n1(page, base, port):
    """The contents rail (owner, 24 Nov 2026: "should contents be on the left? table of contents", "chapters highlighted and be
    able to navigate clicking chapters"): from 1280 px every chapter stands on the left, the one on screen highlighted with its
    articles listed and the one being read marked; a chapter button opens that chapter; an article link opens it; nothing sits
    under the rail; the sides keep 3 columns at 1440 and 5 at 1920. Below 1280 px the rail gives way to the Contents section."""
    problems = []
    page.emulate_media(reduced_motion='reduce')
    for width, cols in [(1280, None), (1440, 3), (1920, 5)]:
        for lang in ['en', 'ru']:
            where = f'{width}px {lang}'
            page.set_viewport_size({'width': width, 'height': 950})
            page.goto(f'{base}?lang={lang}', wait_until='networkidle')
            page.wait_for_selector('article.article .statement')
            page.evaluate("document.getElementById('article-3').scrollIntoView({behavior: 'instant'})")
            page.wait_for_timeout(300)
            got = page.evaluate("""() => ({chapters: document.querySelectorAll('#rail .rch-btn').length, on: [...document.querySelectorAll('#rail .rch.on')].map(n => n.dataset.chapter),
              current: [...document.querySelectorAll('#rail a[aria-current=true]')].map(a => a.dataset.n), listed: [...document.querySelectorAll('#rail .rch')].filter(n => n.querySelector('ol').getClientRects().length).length,
              rail: document.getElementById('rail').getBoundingClientRect().right, left: Math.min(...[...document.querySelectorAll('article.article, #a-head, .intro h1')].map(n => n.getBoundingClientRect().left)),
              topics: document.getElementById('topics').getClientRects().length, side: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              cols: getComputedStyle(document.querySelector('#article-3 .grps')).gridTemplateColumns.split(' ').length, chapter: new URLSearchParams(location.search).get('c') || ''})""")
            if got['chapters'] != 7: problems.append(f'{where}: the rail lists {got["chapters"]} chapters')
            if len(got['on']) != 1 or got['listed'] != 1: problems.append(f'{where}: highlighted {got["on"]}, {got["listed"]} chapter(s) listing articles')
            if got['current'] != ['3']: problems.append(f'{where}: the rail marks {got["current"]} while Article 3 is read')
            if got['left'] < got['rail'] + 8: problems.append(f'{where}: the page starts at {got["left"]:.0f}px, under the rail ending at {got["rail"]:.0f}px')
            if got['topics'] or got['side']: problems.append(f'{where}: the Contents section shows, or the page scrolls sideways')
            if cols and got['cols'] != cols: problems.append(f'{where}: the sides stand in {got["cols"]} columns, not {cols}')
            target = page.locator('#rail .rch:not(.on) .rch-btn').nth(2)
            wanted = target.evaluate('n => n.parentElement.dataset.chapter')
            target.click()
            page.wait_for_function(f"new URLSearchParams(location.search).get('c') === '{wanted}' && document.querySelector('#rail .rch.on')?.dataset.chapter === '{wanted}'", timeout=8000)
            page.wait_for_timeout(1200)
            head = page.evaluate("document.getElementById('a-head').getBoundingClientRect().top")
            bar = page.evaluate("document.querySelector('.bar').getBoundingClientRect().bottom")
            if head < bar - 1 or head > 400: problems.append(f'{where}: after a chapter click its heading stands at {head:.0f}px (bar ends {bar:.0f}px)')
            link = page.locator('#rail .rch.on a[data-n]').last
            number = link.get_attribute('data-n')
            link.click()
            page.wait_for_timeout(900)
            top = page.evaluate(f"document.getElementById('article-{number}').getBoundingClientRect().top")
            bar = page.evaluate("document.querySelector('.bar').getBoundingClientRect().bottom")
            if not (bar - 2 <= top <= bar + 60): problems.append(f'{where}: Article {number} from the rail lands at {top:.0f}px')
    page.set_viewport_size({'width': 1279, 'height': 900})
    page.goto(base, wait_until='networkidle')
    page.wait_for_selector('article.article .statement')
    if page.evaluate("document.getElementById('rail').getClientRects().length") or not page.locator('#topics').is_visible():
        problems.append('at 1279px the rail shows, or the Contents section is gone')
    return problems[:10]


CASES = {
    'P1': ('selection stays on its words across a voice switch', case_p1, (1440, 1000)),
    'ED1': ('Article 1 keeps separate quote links and valid picks across editions', case_edition_selection, (1440, 1000), 'real'),
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
    'T6': ('the translation page: every passage under its section, four versions (Greek, English, 1634, Russian)', case_t6, (390, 844)),
    'E1': ('an article quoted from the new English: modern number, Greek and 1634 on request', case_e1, (390, 844), 'real'),
    'E2': ('an article still on the 1634 English: the new English and the Greek on request', case_e2, (390, 844), 'real'),
    'R1': ('review on a phone: a quote\'s conclusion marked Revise with a note survives a reload; cards no bulkier', case_r1, (390, 844)),
    'R2': ('review: Copy my review and Download as a file carry verdict, sentence and note', case_r2, (390, 844)),
    'R3': ('review: Only what I have not judged hides judged items', case_r3, (390, 844)),
    'R4': ('review: v1 article verdicts carried over once', case_r4, (390, 844)),
    'M1': ('map: an added author\'s marks by effect, one key entry per mark, tie opacity by similarity', case_m1, (1440, 1000)),
    'M2': ('map: no visible label overlaps another at 390 and 1440 px', case_m2, (390, 900)),
    'H1': ('site header on the Stoic pages: the React header\'s links, labels, boxes and colours, EN and RU, no shift', case_h1, (1440, 900), 'real'),
    'H2': ('Sources and Editor switches in the bar: off by default, kept across a reload, a method link, works with storage blocked', case_h2, (1440, 1000), 'real'),
    'H3': ('wide screens: sides in a row share heading, rule and first card within 2 px; the vectors start at the heading', case_h3, (1440, 1000), 'real'),
    'N1': ('contents rail from 1280 px: chapters highlighted and clickable, article marked, nothing under it', case_n1, (1440, 950), 'real'),
    'O1': ('the review is the signed-in admin\'s only, folded into one row; readers keep the method link', case_o1, (390, 844), 'real'),
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


# ---------- the Russian edition ----------
# The page in Russian reads stoic-constitution.ru.json and stoic-constitution/ru/<chapter>.json (scripts/aurelius-constitution.py
# --lang ru). Until the overlay is merged those files do not exist and these checks are skipped, saying so. --ru-dir serves a
# development build (--lang ru --partial --out-dir DIR) in their place; articles the overlay did not cover are English there.
RU_INDEX = ROOT / 'public/apps/stoic-constitution.ru.json'
RU_SIZES = [(360, 740, 'dark'), (390, 844, 'light'), (1440, 1000, 'light')]
# Words in Latin letters a Russian article may show: names, references, and the few terms kept in the original.
RU_LATIN_OK = re.compile(r'^(Ep|EN|RU|EPUB|Markdown|CC|OpenAI|text|embedding|large|Claude|Opus|melos|Perseus|Leopold|logos|[ivxlcdm]+)$', re.I)
# A text node counts as English when it has three or more Latin words that make up 40% or more of its letters: a Greek term in
# transliteration or a few words of the 1634 English quoted in a decision stay allowed. `skip` holds the titles of articles a
# development build left in English (they appear in other articles' neighbour lists).
RU_ENGLISH = """([numbers, skip]) => {
  const ok = new RegExp(%s, 'i'), out = [];
  for (const n of numbers) {
    const root = document.getElementById('article-' + n);
    if (!root) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement.closest('[lang="en"], [lang="grc"], svg, .ctx.old')) continue;   // the English source and the Greek are meant to show
      let text = node.textContent;
      for (const title of skip) text = text.split(title).join('');
      const latin = (text.match(/[A-Za-z][A-Za-z’'-]+/g) || []).filter(word => !ok.test(word));
      const share = latin.join('').length / Math.max(1, (text.match(/\\p{L}/gu) || []).length);
      if (latin.length >= 3 && share >= 0.4) out.push(n + ': ' + node.textContent.trim().slice(0, 70));
    }
  }
  return out.slice(0, 5);
}""" % json.dumps(RU_LATIN_OK.pattern)


def serve_ru(ctx, ru_dir: Path | None) -> None:
    if ru_dir is None:
        return
    ctx.route(re.compile(r'/apps/stoic-constitution\.ru\.json'), lambda route: route.fulfill(body=(ru_dir / 'stoic-constitution.ru.json').read_text(), content_type='application/json'))
    ctx.route(re.compile(r'/apps/stoic-constitution/ru/c\d+\.json'),
              lambda route: route.fulfill(body=(ru_dir / 'stoic-constitution/ru' / route.request.url.split('?')[0].rsplit('/', 1)[1]).read_text(), content_type='application/json'))


def ru_checks(browser, base: str, ru_dir: Path | None, shots: Path | None, quick: bool) -> int:
    """The EN / RU switch, its persistence, a chapter change and the sweep of every chapter, in Russian."""
    index_path = ru_dir / 'stoic-constitution.ru.json' if ru_dir else RU_INDEX
    if not index_path.exists():
        print(f'skip RU: {index_path.relative_to(ROOT) if index_path.is_relative_to(ROOT) else index_path} does not exist yet '
              '(merge the overlay, then run scripts/aurelius-constitution.py --lang ru; or pass --ru-dir with a development build)')
        return 0
    index = json.loads(index_path.read_text())
    assert index.get('language') == 'ru', f'{index_path} is not the Russian index'
    russian = set(index['overlay']['articles'])
    by_chapter: dict[str, list[int]] = {}
    for article in index['articles']:
        by_chapter.setdefault(article['chapter'], []).append(article['number'])
    first, second = list(by_chapter)[0], list(by_chapter)[1]
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    print(f"RU: {len(russian)} of {len(index['articles'])} articles in Russian" + (f' (development build from {ru_dir})' if ru_dir else ''))
    failures = 0

    def watch(page) -> list[str]:
        errors: list[str] = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))
        return errors

    def report(name: str, problems: list[str]) -> None:
        nonlocal failures
        failures += bool(problems)
        print(f"{'ok  ' if not problems else 'FAIL'} RU {name}" + ('' if not problems else ' · ' + '; '.join(problems)))

    # 1. The switch: English first, RU from the header, kept across a reload without ?lang, another chapter, back to EN.
    for width, height in [(390, 844), (1440, 1000)]:
        ctx = browser.new_context(viewport={'width': width, 'height': height})
        serve_ru(ctx, ru_dir)
        page = ctx.new_page()
        errors, problems, fetched = watch(page), [], []
        page.on('request', lambda r: fetched.append(r.url) if '/stoic-constitution' in r.url and r.url.endswith('.json') else None)
        try:
            page.goto(base, wait_until='networkidle')
            page.wait_for_selector('article.article .statement', timeout=15000)
            if page.evaluate('document.documentElement.lang') != 'en':
                problems.append('the page does not start in English')
            if page.locator('.site-header .lang [aria-current=true]').inner_text() != 'EN':
                problems.append('EN is not marked as current')
            page.click('.site-header .lang a[data-lang=ru]')
            page.wait_for_url(re.compile(r'lang=ru'))
            page.wait_for_selector('article.article .statement', timeout=15000)
            state = page.evaluate("""() => ({lang: document.documentElement.lang, head: document.getElementById('a-head').textContent, h1: document.querySelector('h1').textContent,
                current: document.querySelector('.site-header .lang [aria-current=true]').textContent, missing: [...MISSING_RU], stored: localStorage.getItem('stoic-constitution:lang'),
                articles: document.querySelectorAll('article.article').length})""")
            if state['lang'] != 'ru' or state['current'] != 'RU' or state['stored'] != 'ru':
                problems.append(f"after the switch: lang {state['lang']}, current {state['current']}, stored {state['stored']}")
            if not state['head'].startswith('Глава') or state['h1'] != 'Стоическая конституция':
                problems.append(f"headings not in Russian: {state['head'][:40]!r}, {state['h1']!r}")
            if state['articles'] != len(by_chapter[first]):
                problems.append(f"{state['articles']} articles drawn, expected {len(by_chapter[first])}")
            if not any('/stoic-constitution/ru/' in url for url in fetched) or not any(url.endswith('stoic-constitution.ru.json') for url in fetched):
                problems.append('the Russian files were not requested')
            if state['missing']:
                problems.append(f"words without a Russian: {state['missing'][:5]}")
            if shots:
                page.screenshot(path=str(shots / f'ru-{width}-top.png'))
            # Persistence: the plain address, without ?lang, opens in Russian again.
            page.goto(base, wait_until='networkidle')
            page.wait_for_selector('article.article .statement', timeout=15000)
            if page.evaluate('document.documentElement.lang') != 'ru' or 'lang=ru' not in page.url:
                problems.append(f'a reload without ?lang lost the language ({page.url})')
            # Another chapter through the picker.
            page.click('.chap-btn')
            page.locator('#chapters button:not(:disabled)').nth(list(by_chapter).index(second)).click()
            page.wait_for_function(f"document.querySelectorAll('article.article').length === {len(by_chapter[second])} && !!document.querySelector('#article-{by_chapter[second][0]} .statement')", timeout=15000)
            if not page.evaluate("document.getElementById('a-head').textContent").startswith('Глава'):
                problems.append('the second chapter heading is not in Russian')
            if f'c={second}' not in page.url or 'lang=ru' not in page.url:
                problems.append(f'the link lost the chapter or the language: {page.url}')
            # A claim's quotes open, in Russian.
            show = page.locator('li.claim .show').first
            show.evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
            show.click()
            page.wait_for_selector('li.claim .trace', timeout=5000)
            head = page.locator('li.claim .trace .panel-head').first.inner_text()
            if 'Фрагменты' not in head and 'ФРАГМЕНТЫ' not in head:
                problems.append(f'the quotes panel is not in Russian: {head!r}')
            overflow = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            if overflow:
                problems.append(f'overflow {overflow}px')
            if shots:
                page.locator('li.claim .trace').first.evaluate("n => n.scrollIntoView({block: 'start', behavior: 'instant'})")
                page.screenshot(path=str(shots / f'ru-{width}-quotes.png'))
            # Back to English.
            page.click('.site-header .lang a[data-lang=en]')
            page.wait_for_load_state('networkidle')
            page.wait_for_selector('article.article .statement', timeout=15000)
            back = page.evaluate("[document.documentElement.lang, document.getElementById('a-head').textContent, localStorage.getItem('stoic-constitution:lang')]")
            if back[0] != 'en' or not back[1].startswith('Chapter') or back[2] != 'en' or 'lang=ru' in page.url:
                problems.append(f'back to English failed: {back}, {page.url}')
        except Exception as error:
            problems.append(f'could not run: {str(error).splitlines()[0][:200]}')
        if errors:
            problems.append(f'errors {errors[:3]}')
        report(f'switch, reload, chapter, quotes, back to EN at {width}px', problems)
        ctx.close()

    # 2. Every chapter in Russian (?lang=ru on a fresh browser), with and without Seneca.
    for chapter, numbers in by_chapter.items():
        for query in ['', 'with=seneca']:
            for width, height, scheme in RU_SIZES:
                params = '&'.join(x for x in [f'c={chapter}', query, 'lang=ru'] if x)
                ctx = browser.new_context(viewport={'width': width, 'height': height}, color_scheme=scheme)
                serve_ru(ctx, ru_dir)
                page = ctx.new_page()
                errors, problems = watch(page), []
                try:
                    page.goto(base + '?' + params, wait_until='networkidle')
                    page.wait_for_selector(f'#article-{numbers[-1]} .statement', timeout=15000)
                    buttons = page.locator('li.claim .show')
                    for i in range(0, buttons.count(), 3):
                        buttons.nth(i).evaluate("n => n.scrollIntoView({block: 'center', behavior: 'instant'})")
                        buttons.nth(i).click()
                    m = page.evaluate(MEASURE)
                    if m['overflow'] != 0:
                        problems.append(f"overflow {m['overflow']}px")
                    if m['small']:
                        problems.append(f"small text {m['small']}")
                    if m['short']:
                        problems.append(f"short buttons {m['short']}")
                    if sorted(m['articles']) != sorted(f'article-{n}' for n in numbers):
                        problems.append(f"articles drawn {m['articles']}, expected {numbers}")
                    if page.evaluate('document.documentElement.lang') != 'ru':
                        problems.append('?lang=ru did not open the page in Russian')
                    missing = page.evaluate('[...MISSING_RU]')
                    if missing:
                        problems.append(f'words without a Russian: {missing[:5]}')
                    english = page.evaluate(RU_ENGLISH, [[n for n in numbers if n in russian], [a['title'] for a in index['articles'] if a['number'] not in russian]])
                    if english:
                        problems.append(f'English left in Russian articles: {english}')
                    if width >= 1000 and not quick:
                        page.mouse.move(1, 1)
                        for selector in ['.sg[data-refs]', 'svg.map .pt']:
                            items = page.locator(selector)
                            for i in range(0, items.count(), 4):
                                items.nth(i).dispatch_event('mouseenter')
                                items.nth(i).dispatch_event('mouseleave')
                    if shots and chapter == first and not query:
                        page.screenshot(path=str(shots / f'ru-{width}-{scheme}-{chapter}.png'))
                except Exception as error:
                    problems.append(f'could not run: {str(error).splitlines()[0][:200]}')
                if errors:
                    problems.append(f'errors {errors[:3]}')
                report(f"{width}×{height} {scheme:5} {params:28}", problems)
                ctx.close()
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3170)
    parser.add_argument('--quick', action='store_true', help='skip the hover sweep')
    parser.add_argument('--cases', default='', help='comma-separated case names; runs only these, without the sweep')
    parser.add_argument('--no-cases', action='store_true', help='run only the sweep')
    parser.add_argument('--ru-only', action='store_true', help='run only the Russian checks')
    parser.add_argument('--no-ru', action='store_true', help='skip the Russian checks')
    parser.add_argument('--ru-dir', type=Path, default=None, help='serve the Russian files from this development build instead of public/apps')
    parser.add_argument('--shots', type=Path, default=None, help='save screenshots of the Russian page here')
    args = parser.parse_args()
    base = f'http://localhost:{args.port}/apps/stoic-constitution.html'
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # The page opens with Sources and Editor's decisions off. Every case below was written for both on, so each browser
        # context starts with them on unless a case asks for the defaults (case H2 does).
        plain_context = browser.new_context
        def new_context(*args, defaults=False, owner=True, **kwargs):
            ctx = plain_context(*args, **kwargs)
            if not defaults: ctx.add_init_script(SHOW_ALL)
            if owner: ctx.add_init_script(AS_OWNER)
            return ctx
        browser.new_context = new_context
        if args.cases:
            failures = run_cases(browser, base, args.port, [c.strip().upper() for c in args.cases.split(',')])
            browser.close()
            print('all cases pass' if not failures else f'{failures} case(s) failed')
            return 1 if failures else 0
        if args.ru_only:
            failures = ru_checks(browser, base, args.ru_dir.resolve() if args.ru_dir else None, args.shots, args.quick)
            browser.close()
            print('all Russian checks pass' if not failures else f'{failures} Russian check(s) failed')
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
        if not args.no_ru:
            failures += ru_checks(browser, base, args.ru_dir.resolve() if args.ru_dir else None, args.shots, args.quick)
        browser.close()
    print('all checks pass' if not failures else f'{failures} run(s) or case(s) failed')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
