#!/usr/bin/env python3
"""Browser check for the methods paper (public/apps/stoic-method.html), criteria 10 to 13 of plan/stoicism/38-method-paper-goal.md.

Usage: apps/aurelius/.venv/bin/python scripts/stoic-method-check.py [--port 3170] [--pdf DIR] [--shots DIR] [--visual | --no-visual] [--update]

Needs the dev server (npx next dev -p 3170). At 390×844 and 1440×1000, English and Russian, light and dark, it opens the page
and reports:
  - horizontal page scroll (must be 0) and page errors (none);
  - text of the page's own under 12 px (none; figure drawings are checked by the figure tests);
  - the shared header pinned with its EN / RU switch after scrolling to the end;
  - anchors: each section's heading, opened by its link, lands below the pinned header and on screen;
  - the contents list follows the reader: scrolled to a section, its link (or its part's, on a phone) is the marked one;
  - accessibility: axe-core (node_modules/axe-core) with no violations; headings in order (h1, then no level skipped);
    every figure has a numbered caption and every drawing a text description (an SVG's <title> and <desc>, or an image's alt).
Then print: with the print stylesheet, at A4 width, no header or contents list, the folded tables open, no figure or table
taller than a page (so break-inside keeps each one whole), and an A4 PDF per language written with Playwright (to --pdf, default
the system temp folder). Exits 1 if any check fails.

Visual regression (criterion 14). The text of the paper is photographed unit by unit: the front matter (title, byline,
abstract), the contents list, each section from its top to the next section's top (so 3 Methods is its opening only, and 3.1
to 3.8 are their own units), and the footer; in English and Russian, light and dark, at 390 and 1440 px: 8 × 22 images in
tests/aurelius/visual/stoic-method/. Each unit is nudged by less than a pixel to start on a whole pixel, so a change in one section
fails that section only, not every section below it. The figure slots are masked: every drawing is replaced by a striped box of fixed height,
so a change to a figure (st-diagrams' baselines cover those) never moves the text; the pinned header is set in the flow.
A unit fails when its size changes, or when more than 100 of its pixels differ by more than 40 of 255 in any channel
(two runs give 0 changed pixels; one changed comma gives several hundred, one changed word over a thousand). Failures write the new image and a diff (changed pixels in red)
next to the report (--shots, default the system temp folder).
  --visual   only the visual comparison      --no-visual   skip it
  --update   write new baselines (the only way they change); review the diff with git before committing them
"""
import argparse
import base64
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
AXE = ROOT / 'node_modules/axe-core/axe.min.js'
SIZES = [(390, 844), (1440, 1000)]
# A4 less the @page margins (18 + 20 mm top and bottom, 17 + 17 mm sides), in CSS pixels at 96 per inch.
A4_CONTENT_W, A4_CONTENT_H = round((210 - 34) / 25.4 * 96), round((297 - 38) / 25.4 * 96)
SPY = ['introduction', 'm-clustering', 'm-sides', 'results', 'appendix-c']
BASELINES = ROOT / 'tests/aurelius/visual/stoic-method'
VISUAL_PIXEL = 40        # a channel must move by more than this (of 255) for a pixel to count as changed
VISUAL_COUNT = 100       # more than 100 changed pixels fails the unit (a changed comma is several hundred)
SCHEMES = ['light', 'dark']
# Steady pictures: figures masked at a fixed height, the header in the flow, no caret, no smooth scrolling.
VISUAL_CSS = """
html{scroll-behavior:auto!important}
.site-header{position:static!important}
figure.fig > :not(figcaption){display:none!important}
figure.fig::before{content:"";display:block;height:96px;border-radius:6px;
  background:repeating-linear-gradient(45deg,rgba(128,128,128,.35) 0 8px,transparent 8px 16px)}
"""
# Units in page coordinates: the front matter, the contents, each section up to the next one, the footer. Each unit is
# moved (position: relative) by less than a pixel so that it starts on a whole pixel: text is then drawn the same way
# wherever earlier text left it, and a change in one section does not alter the anti-aliasing of every section after it.
UNITS = """() => {
  const lang = document.documentElement.getAttribute('data-lang');
  const block = document.querySelector(lang === 'ru' ? 'main > .ru' : 'main > .en');
  const paper = block.querySelector('article.paper').getBoundingClientRect();
  const list = [];
  list.push(['front', block.querySelector('header .front') || block.querySelector('header'), true]);
  const toc = block.querySelector('.toc');
  if (toc) list.push(['contents', toc, true]);
  const sections = [...block.querySelectorAll('section[data-sec]')];
  sections.forEach((s) => list.push([s.dataset.sec, s, false]));
  const foot = document.querySelector('body > footer');
  if (foot) list.push(['footer', foot, true]);
  // heights from the layout before any nudge: a section runs to the next section's top, or to its own bottom
  const raw = list.map(([, el]) => el.getBoundingClientRect());
  const heights = list.map(([name, el], i) => {
    const s = sections.indexOf(el);
    const next = s >= 0 && sections[s + 1] ? sections[s + 1].getBoundingClientRect().top : Infinity;
    return Math.ceil(Math.min(raw[i].bottom, next) - raw[i].top);
  });
  for (const [, el] of list) {
    const top = el.getBoundingClientRect().top + scrollY;
    el.style.position = 'relative';
    el.style.top = (Math.ceil(top - 0.001) - top) + 'px';
  }
  return list.map(([name, el, wide], i) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.floor((wide ? r.left : Math.min(r.left, paper.left)) - 8));
    const right = Math.min(document.documentElement.clientWidth, Math.ceil((wide ? r.right : Math.max(r.right, paper.right)) + 8));
    return [name, {x, y: Math.round(r.top + scrollY), width: right - x, height: heights[i]}];
  });
}"""
# Compares two PNGs inside the browser (no image library needed): size, share of changed pixels, and a diff picture.
COMPARE = """async ([a, b, pixel]) => {
  const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return {size: `${ia.width}×${ia.height} → ${ib.width}×${ib.height}`};
  const pix = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); return [c, g, g.getImageData(0, 0, c.width, c.height)]; };
  const [, , da] = pix(ia); const [cb, gb, db] = pix(ib);
  let changed = 0;
  const out = gb.createImageData(cb.width, cb.height);
  for (let i = 0; i < da.data.length; i += 4) {
    const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
    if (d > pixel) { changed++; out.data.set([255, 0, 0, 255], i); }
    else { const v = 255 - (255 - (db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3) * 0.25; out.data.set([v, v, v, 255], i); }
  }
  if (!changed) return {changed: 0, total: da.data.length / 4};
  gb.putImageData(out, 0, 0);
  return {changed, total: da.data.length / 4, diff: cb.toDataURL('image/png').split(',')[1]};
}"""

PAGE_FACTS = """() => {
  const lang = document.documentElement.getAttribute('data-lang');
  const block = document.querySelector(lang === 'ru' ? 'main > .ru' : 'main > .en');
  const small = [];
  for (const el of block.querySelectorAll('*')) {
    if (el.closest('svg') || !el.childNodes.length) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !el.getClientRects().length) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) small.push(`${el.tagName.toLowerCase()} ${size}px “${el.textContent.trim().slice(0, 30)}”`);
  }
  const heads = [...block.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => h.getClientRects().length).map((h) => Number(h.tagName[1]));
  const skips = heads.map((n, i) => (i === 0 ? (n === 1 ? '' : `starts at h${n}`) : n > heads[i - 1] + 1 ? `h${heads[i - 1]} → h${n}` : '')).filter(Boolean);
  const figures = [...block.querySelectorAll('figure.fig')].map((f) => {
    const cap = f.querySelector(':scope > figcaption');
    const problems = [];
    if (!cap || !/^(Figure|Рис\\.) \\d+\\./.test(cap.textContent.trim())) problems.push('no numbered caption');
    for (const svg of f.querySelectorAll('svg')) {
      if (svg.closest('svg') !== svg) continue;
      const title = svg.querySelector(':scope > title'), desc = svg.querySelector(':scope > desc');
      if (svg.getAttribute('aria-hidden') === 'true') continue;
      if (!(title && title.textContent.trim()) || !(desc && desc.textContent.trim())) problems.push('an SVG without <title> and <desc>');
    }
    for (const img of f.querySelectorAll('img')) if (!img.alt.trim()) problems.push('an image without alt');
    return problems.length ? `${f.id}: ${problems.join(', ')}` : '';
  }).filter(Boolean);
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    small, skips, figures, lang,
    h1: block.querySelectorAll('h1').length,
  };
}"""

HEADER_PINNED = """() => {
  const h = document.querySelector('.site-header');
  if (!h) return 'no site header';
  const r = h.getBoundingClientRect();
  const sw = h.querySelector('nav.lang a[data-lang]');
  if (Math.abs(r.top) > 1) return `header top at ${r.top}px after scrolling`;
  if (!sw || !sw.getClientRects().length) return 'no visible EN / RU switch in the header';
  return '';
}"""

ANCHOR = """(id) => {
  const el = document.getElementById(id);
  const head = el.querySelector('h2,h3') || el;
  const bar = document.querySelector('.site-header').getBoundingClientRect().bottom;
  const r = head.getBoundingClientRect();
  return r.top >= bar - 1 && r.top < innerHeight * 0.6 ? '' : `#${id}: heading at ${Math.round(r.top)}px, header ends at ${Math.round(bar)}px`;
}"""

SPY_STATE = """() => {
  const lang = document.documentElement.getAttribute('data-lang');
  const toc = document.querySelector(lang === 'ru' ? 'main > .ru .toc' : 'main > .en .toc');
  const cur = toc.querySelector('a[aria-current]');
  const part = toc.querySelector('a.in');
  return {current: cur ? cur.getAttribute('href').slice(1) : null, part: part ? part.getAttribute('href').slice(1) : null};
}"""

PRINT_FACTS = f"""() => {{
  const lang = document.documentElement.getAttribute('data-lang');
  const block = document.querySelector(lang === 'ru' ? 'main > .ru' : 'main > .en');
  const shown = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getClientRects().length);
  const tall = [...block.querySelectorAll('figure.fig, figure.tab')].map((f) => [f.id, Math.round(f.getBoundingClientRect().height)])
    .filter(([id, h]) => h > {A4_CONTENT_H} && !/tab-seneca-articles$/.test(id)).map(([id, h]) => `${{id}} ${{h}}px`);
  const wide = [...block.querySelectorAll('figure, table, svg')].map((e) => [e.id || e.tagName, Math.round(e.getBoundingClientRect().width)])
    .filter(([, w]) => w > {A4_CONTENT_W} + 1).map(([id, w]) => `${{id}} ${{w}}px`);
  return {{
    header: shown('.site-header'), toc: shown('main .toc'),
    closed: [...block.querySelectorAll('details')].filter((d) => !d.open).length,
    tall, wide,
    pageWidth: document.documentElement.scrollWidth,
  }};
}}"""


def check(port: int, pdf_dir: Path, shots: Path | None) -> list[str]:
    fails: list[str] = []
    url = f'http://localhost:{port}/apps/stoic-method.html'
    axe = AXE.read_text()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for lang in ['en', 'ru']:
            for w, h in SIZES:
                for scheme in ['light', 'dark']:
                    tag = f'{lang} {w} {scheme}'
                    ctx = browser.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme)
                    page = ctx.new_page()
                    errors: list[str] = []
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    page.goto(f'{url}?lang={lang}', wait_until='networkidle')
                    page.add_style_tag(content='html{scroll-behavior:auto!important}')
                    facts = page.evaluate(PAGE_FACTS)
                    if facts['lang'] != lang:
                        fails.append(f'{tag}: the page shows {facts["lang"]}')
                    if facts['overflow'] > 0:
                        fails.append(f'{tag}: horizontal scroll of {facts["overflow"]} px')
                    if facts['small']:
                        fails.append(f'{tag}: text under 12 px: {facts["small"][:3]}')
                    if facts['h1'] != 1 or facts['skips']:
                        fails.append(f'{tag}: headings: {facts["h1"]} h1, {facts["skips"][:3]}')
                    if facts['figures']:
                        fails.append(f'{tag}: figures without a text description: {facts["figures"]}')
                    prefix = 'ru-' if lang == 'ru' else ''
                    for sec in SPY:
                        page.evaluate("(id) => { const el = document.getElementById(id); scrollTo(0, el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h')) || 0) - 12); }", prefix + sec)
                        page.wait_for_timeout(120)
                        state = page.evaluate(SPY_STATE)
                        if state['current'] != prefix + sec:
                            fails.append(f'{tag}: scrolled to #{prefix + sec}, the contents list marks {state["current"]}')
                    page.evaluate('scrollTo(0, document.documentElement.scrollHeight)')
                    page.wait_for_timeout(120)
                    pinned = page.evaluate(HEADER_PINNED)
                    if pinned:
                        fails.append(f'{tag}: {pinned}')
                    if scheme == 'light':
                        for sec in ['m-fusion', 'validation', 'references']:
                            page.goto('about:blank')
                            page.goto(f'{url}?lang={lang}#{sec}', wait_until='networkidle')
                            page.wait_for_timeout(250)
                            bad = page.evaluate(ANCHOR, prefix + sec)
                            if bad:
                                fails.append(f'{tag}: anchor {bad}')
                        page.goto(f'{url}?lang={lang}', wait_until='networkidle')
                    page.add_script_tag(content=axe)
                    found = page.evaluate("""async () => {
                      const r = await axe.run(document, {resultTypes: ['violations']});
                      return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
                    }""")
                    if found:
                        fails.append(f'{tag}: axe: {found}')
                    if errors:
                        fails.append(f'{tag}: page errors {errors[:3]}')
                    if shots:
                        shots.mkdir(parents=True, exist_ok=True)
                        page.evaluate('scrollTo(0, 0)')
                        page.screenshot(path=str(shots / f'check-{lang}-{w}-{scheme}.png'))
                    print(f'{tag}: checked', flush=True)
                    ctx.close()
            # print: A4 width, print media, dark system scheme to prove the paper prints light
            ctx = browser.new_context(viewport={'width': A4_CONTENT_W, 'height': A4_CONTENT_H}, color_scheme='dark')
            page = ctx.new_page()
            page.goto(f'{url}?lang={lang}', wait_until='networkidle')
            page.emulate_media(media='print')
            page.evaluate("() => dispatchEvent(new Event('beforeprint'))")
            facts = page.evaluate(PRINT_FACTS)
            if facts['header'] or facts['toc']:
                fails.append(f'print {lang}: the header or contents list still shows')
            if facts['closed']:
                fails.append(f'print {lang}: {facts["closed"]} folded tables stay closed')
            if facts['tall']:
                fails.append(f'print {lang}: taller than an A4 page: {facts["tall"]}')
            if facts['wide']:
                fails.append(f'print {lang}: wider than an A4 page: {facts["wide"]}')
            bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
            if bg not in ('rgb(255, 255, 255)',):
                fails.append(f'print {lang}: background {bg}, not white')
            pdf_dir.mkdir(parents=True, exist_ok=True)
            out = pdf_dir / f'stoic-method-{lang}.pdf'
            page.pdf(path=str(out), format='A4', print_background=True, prefer_css_page_size=True)
            pages = out.read_bytes().count(b'/Type /Page') - out.read_bytes().count(b'/Type /Pages')
            print(f'print {lang}: {out} ({pages} pages)', flush=True)
            ctx.close()
        browser.close()
    return fails


def visual(port: int, update: bool, out_dir: Path) -> list[str]:
    """Photographs every unit of the paper and compares it with its baseline (or writes the baselines with update)."""
    fails: list[str] = []
    url = f'http://localhost:{port}/apps/stoic-method.html'
    seen: set[str] = set()
    written: list[Path] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        judge = browser.new_page()
        for lang in ['en', 'ru']:
            for w, h in SIZES:
                for scheme in SCHEMES:
                    ctx = browser.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme, device_scale_factor=1)
                    page = ctx.new_page()
                    page.goto(f'{url}?lang={lang}', wait_until='networkidle')
                    page.add_style_tag(content=VISUAL_CSS)
                    page.evaluate('document.fonts.ready.then(() => 0)')
                    page.wait_for_timeout(150)
                    for name, clip in page.evaluate(UNITS):
                        key = f'{lang}-{w}-{scheme}-{name}'
                        seen.add(key + '.png')
                        png = page.screenshot(clip=clip, full_page=True, animations='disabled', caret='hide')
                        base = BASELINES / f'{key}.png'
                        r = judge.evaluate(COMPARE, [base64.b64encode(base.read_bytes()).decode(), base64.b64encode(png).decode(), VISUAL_PIXEL]) if base.exists() else None
                        if update:
                            # a baseline is rewritten only when its picture changed at all (not when only the PNG encoding would)
                            if r is None or 'size' in r or r['changed']:
                                BASELINES.mkdir(parents=True, exist_ok=True)
                                base.write_bytes(png)
                                written.append(base)
                            continue
                        if r is None:
                            fails.append(f'visual {key}: no baseline (run with --update, then review it)')
                            continue
                        if 'size' in r or r['changed'] > VISUAL_COUNT:
                            out_dir.mkdir(parents=True, exist_ok=True)
                            (out_dir / f'{key}.new.png').write_bytes(png)
                            if r.get('diff'):
                                (out_dir / f'{key}.diff.png').write_bytes(base64.b64decode(r['diff']))
                            why = f'size {r["size"]}' if 'size' in r else f'{r["changed"]} of {r["total"]} pixels changed ({100 * r["changed"] / r["total"]:.2f} %)'
                            fails.append(f'visual {key}: {why}; see {out_dir / (key + ".new.png")}')
                    print(f'visual {lang} {w} {scheme}: {"written" if update else "compared"}', flush=True)
                    ctx.close()
        browser.close()
    if written:
        # lossless recompression (sharp, already installed with Next.js): the same pixels in about 40 % of the bytes
        squeeze = ("const sharp = require('sharp'); const fs = require('fs');"
                   "(async () => { for (const f of process.argv.slice(1)) {"
                   " const b = await sharp(f).png({compressionLevel: 9, adaptiveFiltering: true, effort: 10}).toBuffer();"
                   " if (b.length < fs.statSync(f).size) fs.writeFileSync(f, b); } })();")
        subprocess.run(['node', '-e', squeeze, *map(str, written)], cwd=ROOT, check=True)
        print(f'visual: wrote {len(written)} baselines')
    stale = sorted(f.name for f in BASELINES.glob('*.png') if f.name not in seen) if BASELINES.exists() else []
    if stale and update:
        for name in stale:
            (BASELINES / name).unlink()
        print(f'visual: removed {len(stale)} baselines of units that no longer exist')
    elif stale:
        fails.append(f'visual: baselines for units the page no longer has: {stale[:5]} (run with --update)')
    return fails


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3170)
    parser.add_argument('--pdf', type=Path, default=Path(tempfile.gettempdir()) / 'stoic-method-pdf')
    parser.add_argument('--shots', type=Path, default=None)
    parser.add_argument('--visual', action='store_true', help='only the visual comparison')
    parser.add_argument('--no-visual', action='store_true', help='skip the visual comparison')
    parser.add_argument('--update', action='store_true', help='write new visual baselines')
    args = parser.parse_args()
    fails: list[str] = []
    if not (args.visual or args.update):
        fails += check(args.port, args.pdf, args.shots)
    if args.update or not args.no_visual:
        fails += visual(args.port, args.update, args.shots or Path(tempfile.gettempdir()) / 'stoic-method-visual')
    for f in fails:
        print('FAIL', f)
    print('ok' if not fails else f'{len(fails)} failures')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
