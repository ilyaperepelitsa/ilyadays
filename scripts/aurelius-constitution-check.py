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
"""
import argparse
import json
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3170)
    parser.add_argument('--quick', action='store_true', help='skip the hover sweep')
    args = parser.parse_args()
    base = f'http://localhost:{args.port}/apps/stoic-constitution.html'
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
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
        browser.close()
    print('all checks pass' if not failures else f'{failures} run(s) failed')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
