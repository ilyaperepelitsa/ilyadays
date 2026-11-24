#!/usr/bin/env python3
"""Browser check of the method page's figures (scripts/stoic-method-figures.py draws them).

Opens public/apps/stoic-method.html from a running server at 390 and 1440 px, light and dark, in English and Russian,
and for every figure: the drawing for that width is the one shown (the phone drawing under 700 px), it fits its frame,
no text in it renders under 12 px, and its layout is clean. The same layout checks run on all 32 share images (square
and landscape, drawn as the PNGs are). Clean means: no two labels overlap; two blocks of different type (size, face or
weight) one above the other are at least a third of the smaller type's size apart; and nothing of the drawing comes within
half the credit's type size of the credit row. Also: no sideways scroll on the page, no script error, and the gallery
(stoic-method/diagrams.html) shows every image. Saves a screenshot of each figure in each state.

Visual regression: each figure's screenshot (the drawings and the download row, not the paper's caption) is compared with
the approved one in tests/aurelius/e2e/method-figures/<id>-<lang>-<width>-<theme>.png (8 figures × EN/RU × 390/1440 ×
light/dark = 64). A pixel counts as changed when any colour channel differs by more than 24 of 255; more than 0.2 % of
pixels changed, or a changed size, fails. Approved screenshots change only on purpose, with --update (after looking).

Run (with the dev server up): apps/aurelius/.venv/bin/python scripts/stoic-method-figures-check.py
        [--base http://localhost:3170] [--out folder for screenshots] [--update] [--share-only]
Exit status 1 on any failure.
"""
from __future__ import annotations

import argparse
import base64
import shutil
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASELINES = Path(__file__).resolve().parents[1] / 'tests/aurelius/e2e/method-figures'
COMPARE = '''async ([a, b]) => {
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const [x, y] = await Promise.all([load(a), load(b)]);
  if (x.width !== y.width || x.height !== y.height) return {size: [x.width, x.height, y.width, y.height]};
  const pixels = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
  const p = pixels(x), q = pixels(y);
  let changed = 0;
  for (let i = 0; i < p.length; i += 4) {
    if (Math.abs(p[i] - q[i]) > 24 || Math.abs(p[i + 1] - q[i + 1]) > 24 || Math.abs(p[i + 2] - q[i + 2]) > 24) changed++;
  }
  return {changed: changed / (p.length / 4)};
}'''
FIGS = ['pipeline', 'embedding', 'dendrogram', 'fusion', 'sides', 'seneca', 'translation', 'checks']

MEASURE = '''(root) => {
  const svg = root.matches('svg') ? root : [...root.querySelectorAll('svg.dg-svg')].find((s) => getComputedStyle(s).display !== 'none');
  if (!svg) return {shown: null};
  const box = svg.getBoundingClientRect();
  const scale = box.width / svg.viewBox.baseVal.width;
  const texts = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim());
  // rotated labels (the phone's column heads) have slanted boxes; their axis-aligned boxes are not compared
  const upright = (t) => !t.closest('[transform*="rotate"]');
  let smallest = Infinity, smallestText = '';
  for (const t of texts) {
    const px = parseFloat(t.getAttribute('font-size')) * scale;
    if (px < smallest) { smallest = px; smallestText = t.textContent.slice(0, 40); }
  }
  const rects = texts.filter(upright).map((t) => {
    const r = t.getBoundingClientRect(), cs = getComputedStyle(t);
    return {x: r.left, y: r.top, w: r.width, h: r.height, s: t.textContent.slice(0, 30),
            style: `${t.getAttribute('font-size')}|${cs.fontFamily}|${cs.fontWeight}`, size: parseFloat(t.getAttribute('font-size')) * scale};
  });
  // Two labels overlap when their glyph boxes share more than a sliver; the box of a line of text includes its
  // line gap, so trim a fifth of the height before comparing. Two blocks of different type (size, face or weight) that
  // sit one above the other are crowded when the space between them is under a third of the smaller type's size: lines
  // of one paragraph may sit close, a label and the next block may not.
  const overlaps = [], crowded = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    const ta = a.h * 0.2, tb = b.h * 0.2;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h - ta, b.y + b.h - tb) - Math.max(a.y + ta, b.y + tb);
    if (ox > 1.5 && oy > 1.5) overlaps.push(`${a.s} × ${b.s}`);
    else if (ox > 1.5 && a.style !== b.style && -oy < Math.min(a.size, b.size) / 3) crowded.push(`${a.s} × ${b.s} (${(-oy).toFixed(1)} px apart)`);
  }
  // Nothing of the drawing may come near the credit row: clear space of at least half the credit's type size above it.
  const footTexts = [...svg.querySelectorAll('.dg-foot text')];
  const foot = footTexts.map((t) => t.getBoundingClientRect());
  const intoFoot = [];
  if (foot.length) {
    const footTop = Math.min(...foot.map((r) => r.top + r.height * 0.2));
    const clear = parseFloat(footTexts[0].getAttribute('font-size')) * scale * 0.5;
    for (const el of svg.querySelectorAll('text, rect, path, line, circle, use, polyline, polygon')) {
      if (el.closest('.dg-foot, defs, clipPath, title') || el.parentNode === svg && el.tagName === 'rect') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const trim = el.tagName === 'text' ? r.height * 0.2 : 0;
      if (r.bottom - trim > footTop - clear && r.top < footTop + 4)
        intoFoot.push(`${el.tagName} “${(el.textContent || el.getAttribute('class') || '').slice(0, 30)}” is ${(footTop - r.bottom + trim).toFixed(1)} px above the credit (needs ${clear.toFixed(1)})`);
    }
  }
  const frame = root.getBoundingClientRect();
  return {shown: svg.classList.contains('dg-tall') ? 'phone' : 'wide', width: box.width, frame: frame.width,
          smallest, smallestText, overlaps, crowded, intoFoot: [...new Set(intoFoot)].slice(0, 6), texts: texts.length};
}'''
SHARE = Path(__file__).resolve().parents[1] / 'public/apps/stoic-method/share'
FONT = Path(__file__).resolve().parents[1] / 'public/fonts/manrope/manrope-variable.woff2'
FONT_FACE = ('@font-face{font-family:Manrope;src:url(data:font/woff2;base64,' + base64.b64encode(FONT.read_bytes()).decode()
             + ") format('woff2');font-weight:200 800}")


def layout_failures(where: str, m: dict) -> list[str]:
    out = [f'{where}: labels overlap: {o}' for o in m.get('overlaps', [])]
    out += [f'{where}: crowded: {c}' for c in m.get('crowded', [])]
    out += [f'{where}: too close to the credit: {c}' for c in m.get('intoFoot', [])]
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3170')
    ap.add_argument('--out', type=Path, default=Path('/tmp/stoic-method-figures'))
    ap.add_argument('--update', '--approve', dest='approve', action='store_true',
                    help='replace the approved screenshots with these (only on purpose, after looking at them)')
    ap.add_argument('--share-only', action='store_true', help='check only the share images\' layout')
    ap.add_argument('--nudge', type=float, default=0, help='self-test: shift the page text by this many px (the screenshots must not change)')
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in (() if args.share_only else (390, 1440)):
            for theme in ('light', 'dark'):
                for lang in ('en', 'ru'):
                    page = browser.new_page(viewport={'width': width, 'height': 900}, color_scheme=theme)
                    errors = []
                    page.on('pageerror', lambda e: errors.append(str(e)))
                    page.goto(f'{args.base}/apps/stoic-method.html?lang={lang}', wait_until='networkidle')
                    page.evaluate('document.fonts.ready')
                    # the pinned site header would sit over the middle of a long figure's screenshot
                    page.add_style_tag(content='.site-header{position:static!important}'
                                       + (f'main,body>article,.paper{{padding-top:{args.nudge}px!important}}' if args.nudge else ''))
                    state = f'{lang} {width} {theme}'
                    if errors:
                        failures.append(f'{state}: script error {errors[0]}')
                    sideways = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
                    if sideways > 0:
                        failures.append(f'{state}: the page scrolls sideways by {sideways} px')
                    for fid in FIGS:
                        sel = f'#{"ru-" if lang == "ru" else ""}dg-{fid}'
                        loc = page.locator(sel)
                        if loc.count() != 1:
                            failures.append(f'{state} {fid}: no figure {sel}')
                            continue
                        m = loc.evaluate(MEASURE)
                        want = 'phone' if width < 700 else 'wide'
                        if m['shown'] != want:
                            failures.append(f'{state} {fid}: shows the {m["shown"]} drawing, expected {want}')
                        if m.get('smallest', 99) < 12:
                            failures.append(f'{state} {fid}: text at {m["smallest"]:.1f} px (“{m["smallestText"]}”)')
                        if m.get('width', 0) > m.get('frame', 0) + 1:
                            failures.append(f'{state} {fid}: drawing {m["width"]:.0f} px wider than its frame {m["frame"]:.0f} px')
                        failures += layout_failures(f'{state} {fid}', m)
                        loc.scroll_into_view_if_needed()
                        # The figure's top depends on the paper's text above it and is rarely a whole pixel; its fraction
                        # would shift every glyph's antialiasing. Snap the figure to whole pixels so that the screenshot
                        # depends on the figure alone.
                        loc.evaluate('''(el) => { el.style.transform = ''; const r = el.getBoundingClientRect();
                          el.style.transform = `translate(${Math.ceil(r.left) - r.left}px, ${Math.ceil(r.top) - r.top}px)`; }''')
                        name = f'{fid}-{lang}-{width}-{theme}.png'
                        shot = args.out / name
                        loc.screenshot(path=str(shot))
                        approved = BASELINES / name
                        if args.approve:
                            BASELINES.mkdir(parents=True, exist_ok=True)
                            shutil.copyfile(shot, approved)
                        elif not approved.exists():
                            failures.append(f'{state} {fid}: no approved screenshot {approved.name}')
                        else:
                            uri = lambda p_: 'data:image/png;base64,' + base64.b64encode(p_.read_bytes()).decode()
                            diff = page.evaluate(COMPARE, [uri(shot), uri(approved)])
                            if 'size' in diff:
                                failures.append(f'{state} {fid}: size changed {diff["size"][2]}×{diff["size"][3]} → {diff["size"][0]}×{diff["size"][1]}')
                            elif diff['changed'] > 0.002:
                                failures.append(f'{state} {fid}: {diff["changed"]:.1%} of pixels differ from the approved screenshot')
                    page.close()
        # the share images: the same layout checks on every square and landscape drawing, at their own size
        page = browser.new_page(viewport={'width': 1200, 'height': 1200})
        for fid in FIGS:
            for lang in ('en', 'ru'):
                for shape in ('square', 'landscape'):
                    name = f'{fid}-{lang}-{shape}.svg'
                    if not (SHARE / name).exists():
                        failures.append(f'share {name}: missing')
                        continue
                    # drawn as the share PNGs are made (scripts/stoic-method-figures.py render_png): the same font, 1:1
                    svg = (SHARE / name).read_text().split('\n', 1)[1]
                    page.set_content(f'<style>{FONT_FACE}html,body{{margin:0}}svg{{display:block}}</style>{svg}')
                    page.evaluate('document.fonts.ready')
                    m = page.evaluate(f'(() => ({MEASURE})(document.querySelector("svg")))()')
                    failures += layout_failures(f'share {name}', m)
        page.close()
        # the gallery
        for lang in (() if args.share_only else ('en', 'ru')):
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            page.goto(f'{args.base}/apps/stoic-method/diagrams.html?lang={lang}', wait_until='networkidle')
            broken = page.evaluate('''() => [...document.querySelectorAll('img')].filter((i) => i.offsetParent && i.loading !== 'lazy' && !i.naturalWidth).length''')
            page.evaluate('async () => { for (const i of document.querySelectorAll("img")) { i.loading = "eager"; } }')
            page.wait_for_timeout(800)
            shown = page.evaluate('''() => [...document.querySelectorAll('img')].filter((i) => i.offsetParent).map((i) => i.naturalWidth)''')
            if broken or len(shown) != len(FIGS) or not all(shown):
                failures.append(f'gallery {lang}: {len(shown)} images shown, {sum(1 for w in shown if not w)} not loaded')
            page.screenshot(path=str(args.out / f'gallery-{lang}-1440.png'), full_page=True)
            page.close()
        browser.close()
    for f in failures:
        print('FAIL', f)
    print(f'{len(failures)} failures; screenshots in {args.out}')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
