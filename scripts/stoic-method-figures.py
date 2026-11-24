#!/usr/bin/env python3
"""The eight figures of the Stoic Constitution's method page, drawn from the published record.

Each figure is drawn three ways from the same data and the same visual language:
  wide    1200 × 627, the LinkedIn landscape image, and the figure on a wide screen (most figures);
  square  1200 × 1200, the LinkedIn square image, and the figure on a wide screen where the drawing needs the height;
  phone   340 wide, a vertical layout for screens under 700 px.
in English and in Russian. On the page the drawings are inline SVG that take the page's colours (light and dark); the
share files are standalone SVG in the light and in the dark colours (…-dark) and PNG made from them with Chromium.

What it writes:
  public/apps/stoic-method.html            between <!-- figure:<id> --> and <!-- /figure:<id> --> in both languages,
                                           and the figures' styles between <!-- dg:style --> and <!-- /dg:style -->
  public/apps/stoic-method/share/          <id>-<lang>-square[-dark].png|svg and <id>-<lang>-landscape[-dark].png|svg
  public/apps/stoic-method/diagrams.html   the gallery of all figures, for sharing

What it reads: public/apps/stoic-constitution*.json and stoic-constitution/[ru/]c*.json (the record),
content/aurelius/translation/*.json (the translations), and public/apps/stoic-method/diagram-data.json (the map's
coordinates, the Ward tree and the gate counts; made by scripts/stoic-method-diagram-data.py). Every number drawn is
marked data-d="<key>" (data-f for decimals, data-fact for a number taken from the page's own text), so that
tests/aurelius/method-diagrams.test.mjs can check it against the published files. Text is measured in Chromium with the
page's fonts, so labels are placed where they fit.

Run: apps/aurelius/.venv/bin/python scripts/stoic-method-figures.py            (page, share SVG and PNG, gallery)
     apps/aurelius/.venv/bin/python scripts/stoic-method-figures.py --no-png   (skip the PNG)
     apps/aurelius/.venv/bin/python scripts/stoic-method-figures.py --preview DIR   (every variant on one sheet, light and dark)
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import math
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
APPS = ROOT / 'public/apps'
PAGE = APPS / 'stoic-method.html'
OUT = APPS / 'stoic-method'
SHARE = OUT / 'share'
GALLERY = OUT / 'diagrams.html'
FONT = ROOT / 'public/fonts/manrope/manrope-variable.woff2'
FONT_FACE = ('@font-face{font-family:Manrope;src:url(data:font/woff2;base64,' + base64.b64encode(FONT.read_bytes()).decode()
             + ') format("woff2");font-weight:200 800}')
ORDER = ['pipeline', 'embedding', 'dendrogram', 'fusion', 'sides', 'seneca', 'translation', 'checks']

# ----------------------------------------------------------------------------------------------------- colours
# Chapters: seven hues in page order, validated with the dataviz validator (adjacent pairs; light on #fff and #f5f7fa,
# dark on #191e26 and #101318). A scatter of all seven at once fails the all-pairs floors, so the map is drawn as
# small multiples: one chapter in colour per panel. Effects of Seneca (Backs, Adds, Limits) pass all pairs in both modes.
# Decisions on a translator's points are an ordinal ramp of one hue (validated with --ordinal).
LIGHT = {
    'bg': '#ffffff', 'ink': '#171b22', 'mu': '#626c7a', 'line': '#dfe4eb', 'faint': '#d3d9e1', 'soft': '#f1f3f6',
    'accent': '#c64227', 'e': '#55468f', 'et': '#ece9f6',
    'p1': '#4379f9', 'p2': '#cc689e', 'p3': '#853f13', 'p4': '#989401', 'p5': '#861192',
    'c1': '#2a62b8', 'c2': '#cf5a2e', 'c3': '#17998a', 'c4': '#c99412', 'c5': '#cc6593', 'c6': '#5e8c1f', 'c7': '#7656c9',
    'fb': '#2a62b8', 'fa': '#17998a', 'fl': '#c64227',
    'd1': '#1d3f73', 'd2': '#4f7fc4', 'd3': '#8fb0e3', 'd4': '#b7bec8',
}
DARK = {
    'faint': '#3a4453', 'soft': '#222932',
    'c1': '#4a86e0', 'c2': '#e06a3a', 'c3': '#1a9f8f', 'c4': '#b98914', 'c5': '#d06898', 'c6': '#73a62c', 'c7': '#8c74e4',
    'fb': '#4a86e0', 'fa': '#1a9f8f', 'fl': '#e0583a',
    'd1': '#cfe0fa', 'd2': '#7fa7e6', 'd3': '#3f6fbf', 'd4': '#59616d',
}
SANS_STACK = "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif"
SERIF_STACK = "Georgia, 'Times New Roman', serif"

RULES = '''
.dg-svg{font-family:var(--dg-sans);overflow:visible}
.dg-svg text{fill:var(--dg-ink);font-family:var(--dg-sans)}
.dg-svg .f{font-family:var(--dg-serif)}
.dg-svg .mu{fill:var(--dg-mu)}
.dg-svg .ac{fill:var(--dg-accent)}
.dg-svg .halo{paint-order:stroke;stroke:var(--dg-bg);stroke-width:5px;stroke-linejoin:round}
.dg-svg .bg{fill:var(--dg-bg)}.dg-svg .soft{fill:var(--dg-soft)}.dg-svg .faint{fill:var(--dg-faint)}.dg-svg .ink{fill:var(--dg-ink)}
.dg-svg .k{stroke:var(--dg-ink)}.dg-svg .km{stroke:var(--dg-mu)}.dg-svg .kl{stroke:var(--dg-line)}.dg-svg .kf{stroke:var(--dg-faint)}.dg-svg .kb{stroke:var(--dg-bg)}
.dg-svg .nf{fill:none}.dg-svg .sac{stroke:var(--dg-accent)}
.dg-svg .ef{fill:var(--dg-e)}.dg-svg .etf{fill:var(--dg-et)}.dg-svg .ek{stroke:var(--dg-e)}
''' + ''.join(f'.dg-svg .{k}{{fill:var(--dg-{k})}}.dg-svg .s{k}{{stroke:var(--dg-{k})}}'
              for k in ['p1', 'p2', 'p3', 'p4', 'p5', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'fb', 'fa', 'fl', 'd1', 'd2', 'd3', 'd4'])


def var_block(tokens: dict[str, str]) -> str:
    return ';'.join(f'--dg-{k}:{v}' for k, v in tokens.items())


# The page's own tokens that a figure file takes when it is inline (site-chrome.css and the page's passage colours), each
# with the light or dark value it falls back to when the file is opened on its own.
PAGE_TOKENS = {'bg': 'card', 'ink': 'ink', 'mu': 'muted', 'line': 'line', 'accent': 'accent', 'e': 'e', 'et': 'et',
               'p1': 'p1', 'p2': 'p2', 'p3': 'p3', 'p4': 'p4', 'p5': 'p5'}
DARK_FALLBACK = {'bg': '#191e26', 'ink': '#edf1f7', 'mu': '#a5afbf', 'line': '#303947', 'accent': '#ffa080', 'e': '#b9adf0',
                 'et': '#2e2948', 'p1': '#2f63e1', 'p2': '#a95e86', 'p3': '#d63a00', 'p4': '#437f43', 'p5': '#2a97bf'}


def themed_css() -> str:
    """The style a figure file carries: the page's tokens where it is inline, light or dark by the reader's setting."""
    def block(values, fallback):
        out = {}
        for k, v in values.items():
            out[k] = f'var(--{PAGE_TOKENS[k]},{fallback.get(k, v)})' if k in PAGE_TOKENS else v
        return var_block(out)
    light = block(LIGHT, LIGHT)
    dark = block({**LIGHT, **DARK, **{k: DARK_FALLBACK[k] for k in PAGE_TOKENS}}, DARK_FALLBACK)
    # short fallbacks without spaces: inline, this style is part of the page's text
    return (f'.dg-svg{{{light};--dg-sans:var(--sans,Manrope,system-ui,sans-serif);--dg-serif:var(--serif,Georgia,serif)}}'
            f'@media(prefers-color-scheme:dark){{.dg-svg{{{dark}}}}}' + RULES.replace('\n', ''))


# The frame around the two drawings on the page: the wide one on a wide screen and in print, the phone one under 700 px.
BLOCK_CSS = ('.dg .dg-svg{display:block;width:100%;height:auto;max-width:none;margin:0}.dg .dg-tall{display:none}'
             '@media(max-width:699px){.dg .dg-wide{display:none}.dg .dg-tall{display:block;max-width:440px;margin-inline:auto}}'
             '@media print{.dg .dg-wide{display:block!important}.dg .dg-tall,.dg .dg-dl{display:none!important}.dg{break-inside:avoid}}'
             '.dg-dl{font:13.5px/1.5 var(--sans);color:var(--muted);margin-top:10px;display:grid;grid-template-columns:auto 1fr;gap:0 14px;align-items:center}'
             '.dg-dl>span:first-child,.dg-dl>a:last-child{grid-column:1/-1}'
             '.dg-dl a{color:var(--muted);text-underline-offset:3px;display:inline-flex;align-items:center;min-height:32px}'
             '.dg-dl a:hover{color:var(--ink)}.dg-g{display:flex;flex-wrap:wrap;gap:0 12px;align-items:center}'
             '.dg-dl b{font-weight:650;color:var(--ink)}.dg-dl>a:last-child{justify-self:start}figure.fig:has(.dg){padding:12px}')


# Share files come in both themes (owner, 24 Nov 2026: "figures need to be downloadable in dark mode too"); the dark one takes
# the page's dark colours, exactly as the figure looks on the page in dark mode.
THEMES = {'light': LIGHT, 'dark': {**LIGHT, **DARK, **DARK_FALLBACK}}


def standalone_css(theme='light') -> str:
    return f'svg{{{var_block(THEMES[theme])};--dg-sans:{SANS_STACK};--dg-serif:{SERIF_STACK}}}' + RULES.replace('\n', '')


# ----------------------------------------------------------------------------------------------------- data
def load_json(path: Path):
    return json.loads(path.read_text())


def load_record(lang: str):
    index = load_json(APPS / ('stoic-constitution.ru.json' if lang == 'ru' else 'stoic-constitution.json'))
    full = {}
    for chapter in {a['chapter'] for a in index['articles']}:
        for article in load_json(APPS / f"stoic-constitution/{'ru/' if lang == 'ru' else ''}{chapter}.json")['articles']:
            full[article['number']] = article
    return index, [full[a['number']] for a in index['articles']]


def decisions(passages, key='check'):
    """Points of the second reader and how they were settled: accepted, partly, declined, free form; found while settling."""
    out = {'accepted': 0, 'partly': 0, 'declined': 0, 'free': 0, 'found': 0}
    for p in passages:
        for x in p.get(key) or []:
            said = x['decided'] if isinstance(x, dict) else x
            if isinstance(x, dict) and x['note'].startswith('Found while settling'):
                out['found'] += 1
            kind = ('partly' if said.startswith('Partly accepted') else 'accepted' if said.startswith('Accepted')
                    else 'declined' if said.startswith('Declined') else 'free')
            out[kind] += 1
    return out


class Data:
    def __init__(self):
        self.rec = {lang: load_record(lang) for lang in ('en', 'ru')}
        self.extra = load_json(OUT / 'diagram-data.json')
        self.marcus = load_json(ROOT / 'content/aurelius/translation/project-v1.json')
        self.seneca = load_json(ROOT / 'content/aurelius/translation/seneca-v1.json')
        self.russian = load_json(ROOT / 'content/aurelius/translation/ru-v1.json')
        index, articles = self.rec['en']
        self.index, self.articles = index, articles
        self.chapters = index['chapters']                      # page order
        self.chapter_no = {c['id']: i + 1 for i, c in enumerate(self.chapters)}
        self.section_article = {s['id']: s['article'] for c in self.chapters for s in c['sections']}
        self.section_chapter = {s['id']: c['id'] for c in self.chapters for s in c['sections']}
        self.values = self.compute()

    def compute(self):
        index, articles = self.index, self.articles
        sen = lambda a: a['voices']['seneca']
        pieces = lambda a: {*(it['piece']['id'] for it in sen(a)['items'] if it.get('piece')),
                            *(s['id'] for it in sen(a)['items'] for s in it.get('support') or [])}
        amends = [c for a in articles for c in sen(a).get('amend') or []]
        refs = {p['ref'] for a in articles for p in sen(a)['passages']}
        filled = lambda key: sum(1 for a in articles if next(g for g in a['groups'] if g['key'] == key)['items'])
        v = {
            'passages': index['method']['passage_count'],
            'dims': int(re.search(r'(\d+)-dimensional', index['method']['input']).group(1)),
            'chapters': len(index['chapters']),
            'sections': sum(len(c['sections']) for c in index['chapters']),
            'articles': len(index['articles']),
            'claims': sum(len(a['claims']) for a in articles),
            'single': sum(len(a['single']) for a in articles),
            'seneca-items': sum(len(sen(a)['items']) for a in articles),
            'seneca-backs': sum(sen(a)['counts']['stronger'] for a in articles),
            'seneca-adds': sum(sen(a)['counts']['wider'] for a in articles),
            'seneca-limits': sum(sen(a)['counts']['qualified'] for a in articles),
            'seneca-pieces': len(set().union(*(pieces(a) for a in articles))),
            'seneca-sections': len(refs),
            'letters': len({re.match(r'^Ep\. (\d+)\.', r).group(1) for r in refs}),
            'seneca-corpus': index['authors'][0]['passages'],
            'seneca-letters-all': index['authors'][0]['units'],
            'clauses': len(amends),
            'clauses-adds': sum(1 for c in amends if c['kind'] == 'adds'),
            'clauses-limits': sum(1 for c in amends if c['kind'] == 'limits'),
            'clauses-challenges': sum(1 for c in amends if c['kind'] == 'challenges'),
            'quotes-marcus': sum(len(c['support']) for a in articles for c in a['claims']) + sum(len(a['single']) for a in articles),
            'tr-marcus': len(self.marcus['passages']),
            'tr-seneca': len(self.seneca['passages']),
            'tr-letters': len(self.seneca['letters']),
            'tr-ru': len(self.russian['passages']),
            'notes-marcus': sum(len(p['notes']) for p in self.marcus['passages']),
            'notes-seneca': sum(len(p['notes']) for p in self.seneca['passages']),
            'qa-blocking': self.extra['gates']['blocking'],
            'qa-warnings': self.extra['gates']['warnings'],
        }
        v['revisions'] = v['tr-marcus'] + v['tr-seneca'] + v['tr-ru']
        for rule, n in self.extra['gates']['warnings_by_rule'].items():
            v[f'qa-rule:{rule}'] = n
        for key in ('why', 'action', 'practice', 'breaks', 'doubt'):
            v[f'fill-{key}'] = filled(key)
        for c in index['chapters']:
            v[f'chapter-passages:{c["id"]}'] = c['size']
            v[f'chapter-sections:{c["id"]}'] = len(c['sections'])
        for name, store, key in (('marcus', self.marcus['passages'], 'check'), ('seneca', self.seneca['passages'], 'check'),
                                 ('ru', self.russian['passages'], 'decisions')):
            for kind, n in decisions(store, key).items():
                v[f'dec-{name}-{kind}'] = n
            v[f'dec-{name}-total'] = sum(n for k, n in decisions(store, key).items() if k != 'found')
        a1 = articles[0]
        v['a1-members'] = len(a1['members'])
        v['a1-sources'] = len(a1['sources'])
        v['a1-claims'] = len(a1['claims'])
        v['a1-single'] = len(a1['single'])
        return v

    def floats(self):
        return {'trust': self.extra['projection']['trustworthiness']}


# ----------------------------------------------------------------------------------------------------- text
class Meter:
    """Text widths from Chromium's canvas with the page's fonts, cached."""

    def __init__(self, page):
        self.page, self.cache = page, {}
        page.set_content(f'''<style>{FONT_FACE}</style>
<p style="font-family:Manrope">x</p><canvas id="c"></canvas>''')
        page.evaluate('''async () => { for (const w of [400,500,600,700,800]) await document.fonts.load(`${w} 20px Manrope`);
          window.__m = (f, t) => { const c = document.getElementById('c').getContext('2d'); c.font = f; return c.measureText(t).width; }; }''')

    def width(self, text: str, size: float, weight: int = 500, serif: bool = False, italic: bool = False) -> float:
        key = (text, weight, serif, italic)
        if key not in self.cache:
            font = f"{'italic ' if italic else ''}{weight} 100px {'Georgia' if serif else 'Manrope'}"
            self.cache[key] = self.page.evaluate('([f, t]) => window.__m(f, t)', [font, text]) / 100
        return self.cache[key] * size


class Ctx:
    lang = 'en'
    prec = 1          # decimals of coordinates in dense paths: 0 on the 1200-wide drawings, 1 on the phone
    hover = True      # <title> tooltips on marks (the phone drawing has no hover)
    meter: Meter = None
    data: Data = None


def esc(s) -> str:
    return html.escape(str(s), quote=True)


def fmt(v, lang=None) -> str:
    lang = lang or Ctx.lang
    if isinstance(v, str):
        return v
    if isinstance(v, float):
        s = f'{v:.2f}'
        return s.replace('.', ',') if lang == 'ru' else s
    if lang == 'ru':
        return f'{v:,}'.replace(',', ' ') if v >= 10000 else str(v)
    return f'{v:,}'


def N(key):
    return ('n', key)


def F(key):
    return ('f', key)


def FACT(value):
    return ('fact', value)


def val(part):
    kind, key = part
    if kind == 'n':
        return Ctx.data.values[key]
    if kind == 'f':
        return Ctx.data.floats()[key]
    return key


def plain(parts) -> str:
    if isinstance(parts, str):
        return parts
    return ''.join(p if isinstance(p, str) else fmt(val(p)) for p in parts)


def markup(parts) -> str:
    if isinstance(parts, str):
        return esc(parts)
    out = []
    for p in parts:
        if isinstance(p, str):
            out.append(esc(p))
        else:
            attr = {'n': 'data-d', 'f': 'data-f', 'fact': 'data-fact'}[p[0]]
            out.append(f'<tspan {attr}="{esc(p[1])}">{esc(fmt(val(p)))}</tspan>')
    return ''.join(out)


def tw(parts, size, weight=500, serif=False, italic=False) -> float:
    return Ctx.meter.width(plain(parts), size, weight, serif, italic)


def T(x, y, parts, size, weight=500, serif=False, italic=False, anchor=None, cls=None, attrs='') -> str:
    a = f' text-anchor="{anchor}"' if anchor else ''
    c = ' '.join(filter(None, ['f' if serif else None, cls]))
    c = f' class="{c}"' if c else ''
    st = ' font-style="italic"' if italic else ''
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size:g}" font-weight="{weight}"{st}{a}{c}{attrs}>{markup(parts)}</text>'


def words_of(parts):
    if isinstance(parts, str):
        parts = [parts]
    words = [[]]
    for p in parts:
        if isinstance(p, str):
            for i, chunk in enumerate(p.split(' ')):
                if i > 0:
                    words.append([])
                if chunk:
                    words[-1].append(chunk)
        else:
            words[-1].append(p)
    return [w for w in words if w]


def wrap(parts, size, maxw, weight=500, serif=False, italic=False):
    """Greedy line breaking; returns a list of lines, each a list of parts."""
    lines, line = [], []
    for word in words_of(parts):
        trial = line + ([' '] if line else []) + word
        if line and tw(trial, size, weight, serif, italic) > maxw:
            lines.append(line)
            line = list(word)
        else:
            line = trial
    if line:
        lines.append(line)
    return lines


def para(x, y, parts, size, maxw, lh=None, weight=500, serif=False, italic=False, anchor=None, cls=None):
    """A wrapped paragraph whose first baseline is y. Returns (svg, number of lines, y of the last baseline)."""
    lh = lh or size * 1.3
    lines = wrap(parts, size, maxw, weight, serif, italic)
    svg = ''.join(T(x, y + i * lh, ln, size, weight, serif, italic, anchor, cls) for i, ln in enumerate(lines))
    return svg, len(lines), y + (len(lines) - 1) * lh


def ru_plural(n, one, few, many):
    n = abs(n) % 100
    if 11 <= n <= 19:
        return many
    n %= 10
    return one if n == 1 else few if 2 <= n <= 4 else many


def rp(key, one, few, many):
    """The Russian noun form for the published number under `key`."""
    return ru_plural(Ctx.data.values[key], one, few, many)


def L(en, ru):
    return ru if Ctx.lang == 'ru' else en


def count(key, en_one, en_many, ru_forms):
    """[number, ' word'] with the word in the right form for the number."""
    n = Ctx.data.values[key]
    word = ru_plural(n, *ru_forms) if Ctx.lang == 'ru' else (en_one if n == 1 else en_many)
    return [N(key), ' ' + word]


# ----------------------------------------------------------------------------------------------------- frame
LAYOUTS = {
    'wide': {'w': 1200, 'h': 627, 'm': 56, 'title': 38, 'sub': 22, 'foot': 21, 'min': 21},
    'square': {'w': 1200, 'h': 1200, 'm': 72, 'title': 50, 'sub': 26, 'foot': 23, 'min': 22},
    'phone': {'w': 340, 'h': None, 'm': 14, 'title': 21, 'sub': 13.5, 'foot': 13, 'min': 13},
}
# The wide design with more height, for a figure whose wide drawing is too tight to stand on the page.
PAGE_H = {'sides': 750, 'seneca': 760}


class Fig:
    """One drawing: frame (title, subtitle, credit) and a body the figure function fills."""

    def __init__(self, fid, number, layout, title, subtitle, desc):
        self.fid, self.number, self.layout = fid, number, layout
        self.cfg = LAYOUTS['wide' if layout == 'page' else layout]
        Ctx.prec = 1 if layout == 'phone' else 0
        Ctx.hover = layout != 'phone'
        self.w, self.h, self.m = self.cfg['w'], (PAGE_H.get(fid, 627) if layout == 'page' else self.cfg['h']), self.cfg['m']
        self.title, self.subtitle, self.desc = title, subtitle, desc
        self.body, self.defs = [], []
        self.key = f'dg-{fid}-{Ctx.lang}-{layout}'
        c = self.cfg
        inner = self.w - 2 * self.m
        if layout == 'phone':
            t_svg, n, last = para(self.m, 30, title, c['title'], inner, c['title'] * 1.18, 400, serif=True)
            s_svg, n2, last2 = para(self.m, last + 22, subtitle, c['sub'], inner, c['sub'] * 1.38, 500, cls='mu')
            self.top = last2 + 26
        else:
            ty = 70 if layout in ('wide', 'page') else 104
            t_svg, n, last = para(self.m, ty, title, c['title'], inner, c['title'] * 1.12, 400, serif=True)
            s_svg, n2, last2 = para(self.m, last + c['sub'] * 1.75, subtitle, c['sub'], inner, c['sub'] * 1.36, 500, cls='mu')
            self.top = last2 + (36 if layout in ('wide', 'page') else 54)
        self.head = t_svg + s_svg
        self.lang = Ctx.lang
        # the drawing ends here; below it, clear space of at least half the credit's type size, then the credit
        self.bottom = None if self.h is None else self.h - (60 if layout in ('wide', 'page') else 84)

    def add(self, svg: str):
        self.body.append(svg)

    def credit(self, y):
        c, m = self.cfg, self.m
        s = c['foot']
        mark = (f'<g transform="translate({m},{y - s * 0.86:.1f}) scale({s / 19:.3f})">'
                f'<rect width="19" height="19" rx="5.5" class="ink"/><rect x="8.3" y="7.6" width="2.4" height="7" rx=".8" class="bg"/>'
                f'<circle cx="9.5" cy="4.9" r="1.35" class="ac"/></g>')
        left = T(m + s * 1.45, y, L('ilyadays.com · Stoic Constitution', 'ilyadays.com · Стоическая конституция'), s, 650, cls='mu')
        right = T(self.w - m, y, L(f'Figure {self.number} · How the Constitution was made', f'Рис. {self.number} · Как сделана конституция'),
                  s, 500, anchor='end', cls='mu') if self.layout != 'phone' else ''
        return f'<g class="dg-foot">{mark}{left}{right}</g>'

    def svg(self, uid: str, cls: str, mode='file') -> str:
        """mode 'file': the figure file, which is also what the page inlines (the page's colours, light and dark);
        'share' / 'share-dark': a standalone image in the light or the dark colours, with its size."""
        Ctx.lang, was = self.lang, Ctx.lang
        try:
            return self._svg(uid, cls, mode)
        finally:
            Ctx.lang = was

    def _svg(self, uid, cls, mode):
        h = self.h
        if h is None:   # phone: the height is what the body used
            h = math.ceil(self.used + 40)
        foot_y = h - (22 if self.layout == 'phone' else 30 if self.layout in ('wide', 'page') else 40)
        share = mode.startswith('share')
        size = f' width="{self.w}" height="{h}"' if share else ''
        ns = ' xmlns="http://www.w3.org/2000/svg"'
        style = f'<style>{standalone_css("dark" if mode == "share-dark" else "light") if share else themed_css()}</style>'
        return (f'<svg{ns} class="dg-svg {cls}" viewBox="0 0 {self.w} {h}"{size} role="img" aria-labelledby="{uid}-t {uid}-d">'
                f'<title id="{uid}-t">{esc(plain(self.title))}</title><desc id="{uid}-d">{esc(plain(self.desc))}</desc>{style}'
                + (f'<defs>{"".join(self.defs)}</defs>' if self.defs else '')
                + f'<rect width="{self.w}" height="{h}" class="bg"/>'
                + self.head + ''.join(self.body) + self.credit(foot_y) + '</svg>')


def chev(x, y, size=7, cls='km'):
    return f'<path d="M{x - size / 2:.1f} {y - size:.1f} L{x + size / 2:.1f} {y:.1f} L{x - size / 2:.1f} {y + size:.1f}" class="nf {cls}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'


def chev_down(x, y, size=7, cls='km'):
    return f'<path d="M{x - size:.1f} {y - size / 2:.1f} L{x:.1f} {y + size / 2:.1f} L{x + size:.1f} {y - size / 2:.1f}" class="nf {cls}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'


def rrect(x, y, w, h, r, cls, extra=''):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{max(w, 0):.1f}" height="{max(h, 0):.1f}" rx="{r:g}" class="{cls}"{extra}/>'


def bar_up(x, base, w, h, r, cls):
    """A column grown from a baseline, rounded only at its data end."""
    if h <= 0:
        return ''
    r = min(r, h, w / 2)
    return (f'<path d="M{x:.2f} {base:.2f} V{base - h + r:.2f} Q{x:.2f} {base - h:.2f} {x + r:.2f} {base - h:.2f} H{x + w - r:.2f} '
            f'Q{x + w:.2f} {base - h:.2f} {x + w:.2f} {base - h + r:.2f} V{base:.2f} Z" class="{cls}"/>')


# ----------------------------------------------------------------------------------------------------- shared glyphs
def chapter_cls(cid):
    return f'c{Ctx.data.chapter_no[cid]}'


def map_points():
    return Ctx.data.extra['projection']['points']


def fit_map(x, y, w, h):
    """Scale the map's [-1, 1] coordinates into a box, keeping the aspect (y up)."""
    pts = map_points()
    xs, ys = [p[1] for p in pts], [p[2] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    s = min(w / (x1 - x0), h / (y1 - y0))
    ox = x + (w - (x1 - x0) * s) / 2
    oy = y + (h - (y1 - y0) * s) / 2
    return lambda px, py: (ox + (px - x0) * s, oy + (y1 - py) * s)


def hover(tip, svg):
    """A mark with a native tooltip on a drawing that has hover; the mark alone on the phone drawing."""
    return f'<g><title>{esc(tip)}</title>{svg}</g>' if Ctx.hover else svg


def dots(points, size, cls, cap='round', opacity=None):
    """Many dots as one path of zero-length strokes: round caps draw circles of diameter size, square caps squares."""
    if not points:
        return ''
    op = f' opacity="{opacity}"' if opacity is not None else ''
    if cap == 'square':
        # squares as filled outlines: zero-length strokes with square caps are dropped when the page is printed to PDF
        q, h = max(Ctx.prec, 1), size / 2
        d = ''.join(f'M{x - h:.{q}f} {y - h:.{q}f}h{size:.{q}f}v{size:.{q}f}h-{size:.{q}f}z' for x, y in points)
        fill = {'km': 'mu', 'k': 'ink', 'sac': 'ac'}.get(cls, cls[1:] if cls.startswith('s') else cls)
        return f'<path d="{d}" class="{fill}"{op}/>'
    d = ''.join(f'M{x:.{Ctx.prec}f} {y:.{Ctx.prec}f}h0' for x, y in points)
    return f'<path d="{d}" class="nf {cls}" stroke-width="{size:.2f}" stroke-linecap="{cap}"{op}/>'


def mini_map(x, y, w, h, r, colour=False):
    to = fit_map(x, y, w, h)
    groups = {}
    for ref, px, py, sec in map_points():
        cls = ('s' + chapter_cls(Ctx.data.section_chapter[sec])) if colour else 'km'
        groups.setdefault(cls, []).append(to(px, py))
    return ''.join(dots(pts, 2 * r, cls, opacity=None if colour else .5) for cls, pts in groups.items())


class Tree:
    """The Ward tree of diagram-data.json, laid out on leaf positions 0..n-1 (with gaps between chapters)."""

    def __init__(self, gap=4.0):
        t = Ctx.data.extra['tree']
        self.top, self.trees = t['top'], t['chapters']
        order = []

        def walk(node):
            if node.startswith('c'):
                order.append(node)
            else:
                a, b, _ = self.top[int(node[1:])]
                walk(a), walk(b)
        walk(f'm{len(self.top) - 1}')
        self.chapter_order = order
        self.pos, self.span, self.root = {}, {}, {}
        self.segments = []   # (chapter id or None, (h, p) for the elbow: list of polylines in (pos, height))
        cursor = 0.0
        for cid in order:
            tree = self.trees[cid]
            leaves, link = tree['leaves'], tree['linkage']
            n = len(leaves)
            place = {}
            for i, ref in enumerate(tree['order']):
                place[leaves.index(ref)] = cursor + i
            self.span[cid] = (cursor, cursor + n - 1)
            for i, ref in enumerate(leaves):
                self.pos[ref] = place[i]
            height = {i: 0.0 for i in range(n)}
            for row, (a, b, h) in enumerate(link):
                node = n + row
                place[node] = (place[a] + place[b]) / 2
                height[node] = h
                self.segments.append((cid, [(place[a], height[a]), (place[a], h), (place[b], h), (place[b], height[b])]))
            self.root[cid] = (place[2 * n - 2], height[2 * n - 2])
            cursor += n + gap
        self.n_pos = cursor - gap
        node_at = {cid: self.root[cid] for cid in order}
        for row, (a, b, h) in enumerate(self.top):
            pa, ha = node_at[a]
            pb, hb = node_at[b]
            self.segments.append((None, [(pa, ha), (pa, h), (pb, h), (pb, hb)]))
            node_at[f'm{row}'] = ((pa + pb) / 2, h)
        self.root_h = self.top[-1][2]
        chapter_roots = sorted(self.root[c][1] for c in order)
        self.chapter_cut = (chapter_roots[-1] + self.top[0][2]) / 2
        self.cuts = {cid: self.trees[cid]['cut'] for cid in order}

    def sections(self):
        """(section id, first position, last position) in leaf order."""
        out = []
        for cid in self.chapter_order:
            secs = {}
            for ref in self.trees[cid]['leaves']:
                sec = next(p[3] for p in map_points() if p[0] == ref)
                secs.setdefault(sec, []).append(self.pos[ref])
            for sec, ps in sorted(secs.items(), key=lambda kv: min(kv[1])):
                out.append((sec, min(ps), max(ps)))
        return out


def radial_tree(cx, cy, R, r0, width=1.0, top_width=1.6, h_max=None):
    """The tree drawn as a circle: leaves on radius R, the root near the centre."""
    tr = Tree()
    h_max = h_max or tr.root_h * 1.06
    total = tr.n_pos + 4     # a gap at the top where the circle closes
    ang = lambda p: -math.pi / 2 + 2 * math.pi * (p + 2) / total
    rad = lambda h: r0 + (R - r0) * (1 - h / h_max)
    pt = lambda p, h: (cx + rad(h) * math.cos(ang(p)), cy + rad(h) * math.sin(ang(p)))
    paths = {}
    for cid, poly in tr.segments:
        (pa, ha), (_, h), (pb, _), (_, hb) = poly
        x1, y1 = pt(pa, ha)
        x2, y2 = pt(pa, h)
        x3, y3 = pt(pb, h)
        x4, y4 = pt(pb, hb)
        large = 1 if abs(ang(pb) - ang(pa)) > math.pi else 0
        sweep = 1 if pb > pa else 0
        q = Ctx.prec
        d = f'M{x1:.{q}f} {y1:.{q}f}L{x2:.{q}f} {y2:.{q}f}A{rad(h):.{q}f} {rad(h):.{q}f} 0 {large} {sweep} {x3:.{q}f} {y3:.{q}f}L{x4:.{q}f} {y4:.{q}f}'
        paths.setdefault(cid, []).append(d)
    svg = []
    for cid, ds in paths.items():
        if cid is None:
            svg.append(f'<path d="{"".join(ds)}" class="nf k" stroke-width="{top_width}" stroke-linecap="round"/>')
        else:
            svg.append(f'<path d="{"".join(ds)}" class="nf s{chapter_cls(cid)}" stroke-width="{width}" stroke-linecap="round"/>')
    return tr, ang, rad, pt, ''.join(svg)


def arc_path(cx, cy, r, a0, a1):
    x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    large = 1 if (a1 - a0) > math.pi else 0
    return f'M{x0:.1f} {y0:.1f}A{r:.1f} {r:.1f} 0 {large} 1 {x1:.1f} {y1:.1f}'


def mini_tree(x, y, size, width=0.9):
    _, _, _, _, svg = radial_tree(x + size / 2, y + size / 2, size / 2, size * 0.02, width, width * 1.4)
    return svg


def mini_chapters(x, y, w, h):
    d = Ctx.data
    rows = len(d.chapters)
    bh = min(12, h / rows * 0.62)
    step = h / rows
    biggest = max(c['size'] for c in d.chapters)
    out = []
    for i, c in enumerate(d.chapters):
        cx = x
        unit = w / biggest
        for s in c['sections']:
            sw = s['size'] * unit
            out.append(rrect(cx, y + i * step, sw - 1.5, bh, 2, chapter_cls(c['id'])))
            cx += sw
    return ''.join(out)


def mini_articles(x, y, w, h):
    d = Ctx.data
    rows = len(d.chapters)
    step = h / rows
    cell = min(step * 0.7, w / max(len(c['sections']) for c in d.chapters) * 0.8)
    pitch = w / max(len(c['sections']) for c in d.chapters)
    out = []
    for i, c in enumerate(d.chapters):
        for j, s in enumerate(c['sections']):
            out.append(rrect(x + j * pitch, y + i * step, cell, cell, 1.5, chapter_cls(c['id'])))
    return ''.join(out)


def mini_waffle(x, y, w, h):
    v = Ctx.data.values
    cells = [('fb', v['seneca-backs']), ('fa', v['seneca-adds']), ('fl', v['seneca-limits'])]
    total = sum(n for _, n in cells)
    cols = 19
    rows = math.ceil(total / cols)
    pitch = min(w / cols, h / rows)
    cell = pitch * 0.78
    out, k = [], 0
    for cls, n in cells:
        pts = []
        for _ in range(n):
            r, c = divmod(k, cols)
            pts.append((x + c * pitch + cell / 2, y + r * pitch + cell / 2))
            k += 1
        out.append(dots(pts, cell, 's' + cls, 'square'))
    return ''.join(out)


def mini_scripts(x, y, w, h, size):
    """Greek and Latin into English, English into Russian: four language tags joined by arrows."""
    pw, ph = size * 2.3, size * 1.5
    lx, rx = x, x + w - pw
    top, bot = y + ph / 2, y + h - ph / 2
    out = [
        f'<path d="M{lx + pw:.1f} {top:.1f} H{rx:.1f}" class="nf km" stroke-width="1.4"/>',
        f'<path d="M{lx + pw:.1f} {bot:.1f} C{(lx + pw + rx) / 2:.1f} {bot:.1f} {(lx + pw + rx) / 2:.1f} {top:.1f} {rx:.1f} {top:.1f}" class="nf km" stroke-width="1.4"/>',
        f'<path d="M{rx + pw / 2:.1f} {top + ph / 2:.1f} V{bot - ph / 2:.1f}" class="nf km" stroke-width="1.4"/>',
    ]
    for (px, py, label, dark) in ((lx, top, 'GR', False), (lx, bot, 'LA', False), (rx, top, 'EN', True), (rx, bot, 'RU', True)):
        out.append(rrect(px, py - ph / 2, pw, ph, ph / 2, 'ink' if dark else 'soft'))
        out.append(T(px + pw / 2, py + size * 0.36, label, size, 750, anchor='middle', cls='bg' if dark else None))
    return ''.join(out)


def mini_grid(x, y, w, h, r):
    n = Ctx.data.values['passages']
    cols = 21 if w / h < 1.3 else 30
    rows = math.ceil(n / cols)
    pitch = min(w / cols, h / rows)
    pts = [(x + (k % cols) * pitch + pitch / 2, y + (k // cols) * pitch + pitch / 2) for k in range(n)]
    return dots(pts, 2 * r, 'km', opacity=.5)


# ----------------------------------------------------------------------------------------------------- 1 pipeline
def pipeline_stages():
    return [
        ('grid', [N('passages')], L('passages', rp('passages', 'фрагмент', 'фрагмента', 'фрагментов')), L(['Marcus, in the 1634 English'], ['Марк в английском 1634 года'])),
        ('map', [N('passages')], L('vectors', rp('passages', 'вектор', 'вектора', 'векторов')), L([N('dims'), ' numbers each, by meaning'], ['по ', N('dims'), ' числа, по смыслу'])),
        ('tree', ['1'], L('tree', 'дерево'), L(['Ward’s method joins them'], ['метод Уорда их объединяет'])),
        ('chapters', [N('chapters')], L('chapters', rp('chapters', 'глава', 'главы', 'глав')),
         [N('sections'), L(' sections, cut from the tree', rp('sections', ' раздел, срезанный', ' раздела, срезанных', ' разделов, срезанных') + ' с дерева')]),
        ('articles', [N('articles')], L('articles', rp('articles', 'статья', 'статьи', 'статей')),
         L([N('claims'), ' fused claims, ', N('single'), ' said once'], [N('claims'), rp('claims', ' утверждение, ', ' утверждения, ', ' утверждений, '), N('single'), ' — сказано однажды'])),
        ('waffle', [N('seneca-items')], L('Seneca items', rp('seneca-items', 'вклад Сенеки', 'вклада Сенеки', 'вкладов Сенеки')),
         L(['Backs, Adds or Limits; ', N('seneca-pieces'), ' quotes from ', N('letters'), ' letters'],
           ['Подкрепляет, Добавляет или Ограничивает; ', N('seneca-pieces'), rp('seneca-pieces', ' цитата из ', ' цитаты из ', ' цитат из '), N('letters'), rp('letters', ' письма', ' писем', ' писем')])),
        ('scripts', [N('tr-ru')], L('passages in Russian', rp('tr-ru', 'фрагмент', 'фрагмента', 'фрагментов') + ' по-русски'),
         L([N('tr-marcus'), ' from the Greek and ', N('tr-seneca'), ' from the Latin into English, then all into Russian'],
           [N('tr-marcus'), ' с греческого и ', N('tr-seneca'), ' с латыни на английский, затем все на русский'])),
    ]


def glyph(kind, x, y, w, h, fine):
    was, Ctx.prec = Ctx.prec, 0       # the little drawings carry hundreds of points; whole units are enough
    try:
        return _glyph(kind, x, y, w, h, fine)
    finally:
        Ctx.prec = was


def _glyph(kind, x, y, w, h, fine):
    if kind == 'grid':
        return mini_grid(x, y, w, h, 1.5 if fine else 2.2)
    if kind == 'map':
        return mini_map(x, y, w, h, 1.2 if fine else 1.9)
    if kind == 'tree':
        s = min(w, h)
        return mini_tree(x + (w - s) / 2, y + (h - s) / 2, s, 0.55 if fine else 0.9)
    if kind == 'chapters':
        return mini_chapters(x, y + 2, w, h)
    if kind == 'articles':
        return mini_articles(x, y + 2, w, h)
    if kind == 'waffle':
        return mini_waffle(x, y, w, h)
    if kind == 'scripts':
        return mini_scripts(x, y + h * 0.1, w, h * 0.8, 13 if fine else 21)


def fig_pipeline(layout):
    v = Ctx.data.values
    title = L([f'From ', N('passages'), ' passages to ', N('articles'), ' articles'], ['От ', N('passages'), ' фрагментов к ', N('articles'), ' статьям'])
    sub = L('Marcus Aurelius’s Meditations, measured by meaning, grouped, fused, joined by Seneca and translated',
            '«Размышления» Марка Аврелия: измерены по смыслу, сгруппированы, слиты, дополнены Сенекой и переведены')
    desc = L(f"Seven stages: {v['passages']} passages; {v['passages']} vectors of {v['dims']} numbers; one Ward tree; {v['chapters']} chapters and {v['sections']} sections; {v['articles']} articles with {v['claims']} fused claims and {v['single']} said once; {v['seneca-items']} items of Seneca; {v['tr-ru']} passages translated into Russian.",
             f"Семь этапов: {v['passages']} {rp('passages', 'фрагмент', 'фрагмента', 'фрагментов')}; {v['passages']} {rp('passages', 'вектор', 'вектора', 'векторов')} по {v['dims']} {rp('dims', 'числу', 'числа', 'чисел')}; одно дерево Уорда; {v['chapters']} {rp('chapters', 'глава', 'главы', 'глав')} и {v['sections']} {rp('sections', 'раздел', 'раздела', 'разделов')}; {v['articles']} {rp('articles', 'статья', 'статьи', 'статей')}, {v['claims']} {rp('claims', 'утверждение', 'утверждения', 'утверждений')} и {v['single']} — сказано однажды; {v['seneca-items']} {rp('seneca-items', 'вклад', 'вклада', 'вкладов')} Сенеки; {v['tr-ru']} {rp('tr-ru', 'фрагмент переведён', 'фрагмента переведены', 'фрагментов переведены')} на русский.")
    f = Fig('pipeline', 1, layout, title, sub, desc)
    stages = pipeline_stages()
    if layout in ('wide', 'page'):
        gap = 22
        n = len(stages)
        sw = (f.w - 2 * f.m - gap * (n - 1)) / n
        gy, gh = f.top + 6, 128
        short = [None, L([N('dims'), ' numbers each'], [N('dims'), ' числа в каждом']), L('Ward’s method', 'метод Уорда'), None, None,
                 L([N('seneca-pieces'), ' quotes from ', N('letters'), ' letters'], [N('seneca-pieces'), ' цитата из ', N('letters'), ' писем']),
                 L([N('tr-marcus'), ' from Greek, ', N('tr-seneca'), ' from Latin, all into Russian'], [N('tr-marcus'), ' с греческого, ', N('tr-seneca'), ' с латыни, все на русский'])]
        for i, (kind, num, label, note) in enumerate(stages):
            note = short[i] or note
            x = f.m + i * (sw + gap)
            f.add(glyph(kind, x + 4, gy, sw - 8, gh, False))
            if i < n - 1:
                f.add(chev(x + sw + gap / 2, gy + gh / 2, 6))
            ny = gy + gh + 52
            f.add(T(x, ny, num, 44, 700))
            f.add(para(x, ny + 30, label, 21, sw, 25, 700)[0])
            lab_lines = len(wrap(label, 21, sw, 700))
            f.add(para(x, ny + 30 + lab_lines * 25 + 4, note, 21, sw, 25.5, 500, cls='mu')[0])
            f.add(f'<line x1="{x:.1f}" y1="{gy + gh + 12:.1f}" x2="{x + sw:.1f}" y2="{gy + gh + 12:.1f}" class="kl" stroke-width="1"/>')
    else:
        sq = layout == 'square'
        top, bottom = f.top, (f.bottom if sq else None)
        n = len(stages)
        row = (bottom - top) / n if sq else 96
        g = row - (16 if sq else 18)
        gw = g * (1.75 if sq else 1.0)
        tx = f.m + gw + (40 if sq else 16)
        tw_max = f.w - f.m - tx
        y = top
        for i, (kind, num, label, note) in enumerate(stages):
            box_w = g if kind in ('tree',) else gw
            f.add(glyph(kind, f.m + (gw - box_w) / 2, y, box_w, g, not sq))
            if i < n - 1:
                f.add(chev_down(f.m + gw / 2, y + row - (7 if sq else 8), 5 if sq else 4))
            ns, ls = (58, 32) if sq else (23, 14)
            base = y + (ns * 0.9 if sq else ns * 0.9)
            numw = tw(num, ns, 700)
            f.add(T(tx, base, num, ns, 700))
            f.add(T(tx + numw + (14 if sq else 6), base, label, ls, 700))
            note_size = 25 if sq else 13
            f.add(para(tx, base + (40 if sq else 19), note, note_size, tw_max, note_size * 1.3, 500, cls='mu')[0])
            y += row
        f.used = y
    return f


# ----------------------------------------------------------------------------------------------------- 2 map
def chapter_name(cid):
    index = Ctx.data.rec[Ctx.lang][0]
    return next(c['title'] for c in index['chapters'] if c['id'] == cid)


def map_panel(f, cid, x, y, w, h, r_bg, r_fg, numbers, num_size):
    to = fit_map(x, y, w, h)
    d = Ctx.data
    out = [rrect(x - 6, y - 6, w + 12, h + 12, 6, 'soft')]
    mine = []
    for ref, px, py, sec in map_points():
        cx, cy = to(px, py)
        if d.section_chapter[sec] == cid:
            mine.append((cx, cy, sec))
    cls = chapter_cls(cid)
    # every passage in grey: one path in <defs>, placed in each panel by <use>
    ref_id = f'{f.key}-all'
    if not getattr(f, 'all_dots', None):
        here = fit_map(0, 0, w, h)
        f.all_dots = (round(w, 3), round(h, 3))
        f.defs.append(dots([here(px, py) for _, px, py, _ in map_points()], 2 * r_bg, 'kf').replace('<path ', f'<path id="{ref_id}" ', 1))
    assert f.all_dots == (round(w, 3), round(h, 3)), 'map panels must share one size'
    out.append(f'<use href="#{ref_id}" x="{x:.{Ctx.prec}f}" y="{y:.{Ctx.prec}f}"/>')
    out.append(dots([(a, b) for a, b, _ in mine], 2 * r_fg + r_fg * 0.9, 'kb'))
    out.append(dots([(a, b) for a, b, _ in mine], 2 * r_fg, 's' + cls))
    if numbers:
        cent = {}
        for cx, cy, sec in mine:
            cent.setdefault(sec, []).append((cx, cy))
        labels = []
        for sec, ps in cent.items():
            mx, my = sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps)
            label = str(d.section_article[sec])
            labels.append([mx, my, tw(label, num_size, 750) + 7, num_size * 1.05, sec, label, mx, my])
        # push labels apart until a clear gap separates them (a leader line then runs back to the true centre),
        # and keep them in the panel
        pad = num_size * 0.3
        for _ in range(400):
            moved = False
            for i in range(len(labels)):
                for j in range(i + 1, len(labels)):
                    a, b = labels[i], labels[j]
                    ox = (a[2] + b[2]) / 2 + pad - abs(a[0] - b[0])
                    oy = (a[3] + b[3]) / 2 + pad - abs(a[1] - b[1])
                    if ox > 0 and oy > 0:
                        moved = True
                        if ox < oy:
                            sgn = 1 if a[0] >= b[0] else -1
                            a[0] += sgn * ox / 2 + sgn * 0.5
                            b[0] -= sgn * ox / 2 + sgn * 0.5
                        else:
                            sgn = 1 if a[1] >= b[1] else -1
                            a[1] += sgn * oy / 2 + sgn * 0.5
                            b[1] -= sgn * oy / 2 + sgn * 0.5
            for a in labels:
                a[0] = min(max(a[0], x + a[2] / 2), x + w - a[2] / 2)
                a[1] = min(max(a[1], y + a[3] / 2), y + h - a[3] / 2)
            if not moved:
                break
        for mx, my, lw, lh, sec, label, ox_, oy_ in labels:
            if math.hypot(mx - ox_, my - oy_) > lh * 0.9:
                out.append(f'<line x1="{ox_:.1f}" y1="{oy_:.1f}" x2="{mx:.1f}" y2="{my:.1f}" class="km" stroke-width="1"/>')
            title = f'{label} · {next(s["title"] for c in d.rec[Ctx.lang][0]["chapters"] for s in c["sections"] if s["id"] == sec)}'
            out.append(hover(L("Article ", "Статья ") + title, T(mx, my + num_size * 0.35, label, num_size, 750, anchor='middle', cls='halo')))
    f.add(''.join(out))


def fig_embedding(layout):
    d, v = Ctx.data, Ctx.data.values
    title = L([N('passages'), ' passages, placed by meaning'], [N('passages'), ' фрагментов, расставленных по смыслу'])
    sub = L('Each dot is one passage; dots that are near each other have similar vectors. One panel per chapter.',
            'Каждая точка — фрагмент; близкие точки — похожие векторы. По панели на главу.')
    desc = L(f"Seven small maps of the same {v['passages']} passages, flattened from {v['dims']} dimensions by t-SNE; in each, one chapter's passages are coloured and numbered by article, the rest are grey.",
             f"Семь малых карт одних и тех же {v['passages']} фрагментов, сведённых из {v['dims']} измерений методом t-SNE; на каждой цветом выделены фрагменты одной главы с номерами статей, остальные серые.")
    f = Fig('embedding', 2, layout, title, sub, desc)
    chapters = [c['id'] for c in d.chapters]
    key_note = L(['Grey: all ', N('passages'), ' passages. Colour: one chapter. Numbers: its articles, at the centre of each section’s passages.'],
                 ['Серые: все ', N('passages'), ' фрагментов. Цвет: одна глава. Числа: её статьи, в центре фрагментов каждого раздела.'])
    method = L(['t-SNE of the ', N('dims'), '-number vectors (cosine, perplexity 50). Trustworthiness ', F('trust'), ': most near neighbours stay near; distances far apart are not to scale.'],
               ['t-SNE векторов из ', N('dims'), ' чисел (косинус, перплексия 50). Достоверность ', F('trust'), ': ближайшие соседи в основном остаются рядом; большие расстояния не в масштабе.'])
    if layout in ('wide', 'square'):
        cols, rows = (4, 2) if layout in ('wide', 'page') else (3, 3)
        gx, gy = (26, 22) if layout in ('wide', 'page') else (34, 30)
        area_w = f.w - 2 * f.m
        area_h = f.bottom - f.top
        pw = (area_w - gx * (cols - 1)) / cols
        ph = (area_h - gy * (rows - 1)) / rows
        hs = 21 if layout in ('wide', 'page') else 23
        for k, cid in enumerate(chapters):
            r_, c_ = divmod(k, cols)
            x = f.m + c_ * (pw + gx)
            y = f.top + r_ * (ph + gy)
            name = [f'{d.chapter_no[cid]} ', chapter_name(cid)]
            lines = wrap(name, hs, pw, 700)
            head = ''.join(T(x, y + hs + i * hs * 1.15, ln, hs, 700) for i, ln in enumerate(lines[:2]))
            f.add(head)
            meta = L([N(f'chapter-passages:{cid}'), ' passages · ', N(f'chapter-sections:{cid}'), ' sections'],
                     [N(f'chapter-passages:{cid}'), ' фрагм. · ', N(f'chapter-sections:{cid}'), ' разд.'])
            plot_y = y + hs * 1.15 * 2 + 14       # the same box in every panel, so the grey dots are drawn once
            ms = 16 if layout in ('wide', 'page') else 21
            plot_h = y + ph - plot_y - 6 - ms * 1.3
            map_panel(f, cid, x + 6, plot_y + 6, pw - 12, plot_h - 12, 1.5 if layout in ('wide', 'page') else 1.9,
                      2.8 if layout in ('wide', 'page') else 3.8, True, 19 if layout in ('wide', 'page') else 21)
            f.add(T(x, y + ph - 2, meta, ms, 600, cls='mu'))
        # the key in the last slot(s)
        k = len(chapters)
        r_, c_ = divmod(k, cols)
        x = f.m + c_ * (pw + gx)
        y = f.top + r_ * (ph + gy)
        kw = pw if layout in ('wide', 'page') else pw * 2 + gx
        ks = 16 if layout in ('wide', 'page') else 22
        f.add(T(x, y + ks + 2, L('How to read it', 'Как читать'), ks + 2, 700))
        s1, n1, last = para(x, y + ks * 2 + 12, key_note, ks, kw, ks * 1.25)
        f.add(s1)
        if layout in ('wide', 'page'):
            method = L(['t-SNE, cosine; trustworthiness ', F('trust')], ['t-SNE, косинус; достоверность ', F('trust')])
        f.add(para(x, last + ks * 1.5, method, ks - (1 if layout in ('wide', 'page') else 0), kw, ks * 1.22, cls='mu')[0])
    else:
        cols = 2
        gx, gy = 14, 18
        pw = (f.w - 2 * f.m - gx) / cols
        ph = 150
        y0 = f.top
        for k, cid in enumerate(chapters):
            r_, c_ = divmod(k, cols)
            x = f.m + c_ * (pw + gx)
            y = y0 + r_ * (ph + gy)
            lines = wrap([f'{d.chapter_no[cid]} ', chapter_name(cid)], 13, pw, 700)
            f.add(''.join(T(x, y + 13 + i * 15.5, ln, 13, 700) for i, ln in enumerate(lines[:3])))
            plot_y = y + 15.5 * 2 + 10
            map_panel(f, cid, x + 4, plot_y + 4, pw - 8, y + ph - plot_y - 8, 0.9, 1.6, False, 0)
        k = len(chapters)
        r_, c_ = divmod(k, cols)
        x = f.m + c_ * (pw + gx)
        y = y0 + r_ * (ph + gy)
        key_short = L(['Grey: all ', N('passages'), ' passages. Colour: one chapter.'], ['Серые: все ', N('passages'), ' фрагментов. Цвет: одна глава.'])
        s1, n1, last = para(x, y + 13, key_short, 13, pw, 17)
        f.add(s1)
        last_row_bottom = y0 + 4 * (ph + gy)
        s2, n2, last2 = para(f.m, last_row_bottom + 6, method, 13, f.w - 2 * f.m, 17, cls='mu')
        f.add(s2)
        f.used = last2 + 10
    return f


# ----------------------------------------------------------------------------------------------------- 3 tree
def tree_drawing(f, cx, cy, R, numbers_size, chapter_size, width):
    d = Ctx.data
    tr, ang, rad, pt, svg = radial_tree(cx, cy, R, R * 0.03, width, width * 1.6)
    out = []
    # the two cuts: the whole tree into chapters, each chapter into sections
    rc = rad(tr.chapter_cut)
    out.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rc:.1f}" class="nf km" stroke-width="1" opacity=".75"/>')
    for cid in tr.chapter_order:
        a0, a1 = tr.span[cid]
        rs = rad(tr.cuts[cid])
        out.append(f'<path d="{arc_path(cx, cy, rs, ang(a0 - 0.5), ang(a1 + 0.5))}" class="nf k" stroke-width="1.3" opacity=".9"/>')
    out.append(svg)
    # the sections as an outer ring, article numbers outside it
    ring_in, ring_out = R + R * 0.03, R + R * 0.075
    for sec, p0, p1 in tr.sections():
        a0, a1 = ang(p0 - 0.42), ang(p1 + 0.42)
        mid = (a0 + a1) / 2
        cls = chapter_cls(d.section_chapter[sec])
        out.append(f'<path d="{arc_path(cx, cy, (ring_in + ring_out) / 2, a0, a1)}" class="nf s{cls}" stroke-width="{ring_out - ring_in:.1f}"/>')
        n = d.section_article[sec]
        arc_len = (a1 - a0) * (ring_out + numbers_size)
        label = str(n)
        if arc_len >= tw(label, numbers_size, 650) + 3:
            rr = ring_out + numbers_size * 0.95
            out.append(hover(L("Article ", "Статья ") + label, T(cx + rr * math.cos(mid), cy + rr * math.sin(mid) + numbers_size * 0.35, label, numbers_size, 650, anchor='middle', cls='mu')))
    # chapter numbers, further out
    for cid in tr.chapter_order:
        a0, a1 = tr.span[cid]
        mid = (ang(a0) + ang(a1)) / 2
        rr = ring_out + numbers_size * 2.15 + chapter_size * 0.55
        x, y = cx + rr * math.cos(mid), cy + rr * math.sin(mid)
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{chapter_size * 0.78:.1f}" class="{chapter_cls(cid)}"/>')
        out.append(T(x, y + chapter_size * 0.36, str(d.chapter_no[cid]), chapter_size, 800, anchor='middle', cls='bg'))
    f.add(''.join(out))
    return tr, rad


def tree_legend(f, x, y, w, size, row_gap, two_line=True, cols=1, col_gap=30, ranges=False):
    d = Ctx.data
    out = []
    cw = (w - col_gap * (cols - 1)) / cols
    per = math.ceil(len(d.chapters) / cols)
    yy = y
    max_y = y
    for k, c in enumerate(d.chapters):
        col, rowi = divmod(k, per)
        if rowi == 0:
            yy = y
        x0 = x + col * (cw + col_gap)
        cid = c['id']
        r = size * 0.72
        out.append(f'<circle cx="{x0 + r:.1f}" cy="{yy - size * 0.34:.1f}" r="{r:.1f}" class="{chapter_cls(cid)}"/>')
        out.append(T(x0 + r, yy - size * 0.02, str(d.chapter_no[cid]), size if size < 16 else size * 0.92, 800, anchor='middle', cls='bg'))
        tx = x0 + r * 2 + size * 0.5
        first = d.section_article[c['sections'][0]['id']]
        last = d.section_article[c['sections'][-1]['id']]
        name_lines = wrap(chapter_name(cid), size, cw - (tx - x0) - (size * 3.4 if ranges else 0), 650)
        for i, ln in enumerate(name_lines):
            out.append(T(tx, yy + i * size * 1.2, ln, size, 650))
        if ranges:
            end_x = tx + tw(name_lines[-1], size, 650) + size * 0.6
            out.append(T(end_x, yy + (len(name_lines) - 1) * size * 1.2, f'{first}–{last}', size, 500, cls='mu'))
        yy += (len(name_lines) - 1) * size * 1.2
        if two_line:
            meta = L([N(f'chapter-passages:{cid}'), ' passages · ', N(f'chapter-sections:{cid}'), f' sections · articles {first}–{last}'],
                     [N(f'chapter-passages:{cid}'), ' фрагм. · ', N(f'chapter-sections:{cid}'), f' разд. · статьи {first}–{last}'])
            out.append(T(tx, yy + size * 1.25, meta, size if size < 16 else size * 0.9, 500, cls='mu'))
            yy += size * 1.25
        max_y = max(max_y, yy)
        yy += size * (1.25 if two_line else 1.2) + row_gap + (size * 0.2 if not two_line else 0)
    f.add(''.join(out))
    return max_y


def fig_dendrogram(layout):
    v = Ctx.data.values
    title = L('One tree, cut twice', 'Одно дерево, разрезанное дважды')
    sub = L(['Ward’s method joins the ', N('passages'), ' passages into one tree; it is cut into ', N('chapters'), ' chapters, and each chapter into sections: ', N('sections'), ' in all, one article each.'],
            ['Метод Уорда объединяет ', N('passages'), ' фрагментов в одно дерево; его режут на ', N('chapters'), ' глав, а каждую главу — на разделы: всего ', N('sections'), ', по статье на каждый.'])
    desc = L(f"A circular dendrogram: {v['passages']} leaves on the rim, the root at the centre. A grey circle marks the cut into {v['chapters']} chapters; a dark arc in each chapter marks its cut into sections; the outer ring shows the {v['sections']} sections with their article numbers.",
             f"Круговая дендрограмма: {v['passages']} листьев по краю, корень в центре. Серый круг — разрез на {v['chapters']} глав; тёмная дуга в каждой главе — разрез на разделы; внешнее кольцо — {v['sections']} разделов с номерами статей.")
    f = Fig('dendrogram', 3, layout, title, sub, desc)
    key = [(L('Cut into chapters', 'Разрез на главы'), 'circle'), (L('Cut into sections', 'Разрез на разделы'), 'arc')]

    def cut_key(x, y, size, w):
        out = []
        out.append(f'<circle cx="{x + size * 0.6:.1f}" cy="{y - size * 0.35:.1f}" r="{size * 0.55:.1f}" class="nf km" stroke-width="1"/>')
        out.append(T(x + size * 1.7, y, L('the cut into chapters', 'разрез на главы'), size, 500, cls='mu'))
        y2 = y + size * 1.5
        out.append(f'<path d="M{x:.1f} {y2 - size * 0.1:.1f} Q{x + size * 0.6:.1f} {y2 - size * 0.8:.1f} {x + size * 1.2:.1f} {y2 - size * 0.1:.1f}" class="nf k" stroke-width="1.3"/>')
        out.append(T(x + size * 1.7, y2, L('each chapter’s cut into sections', 'разрез главы на разделы'), size, 500, cls='mu'))
        y3 = y2 + size * 1.5
        out.append(f'<path d="M{x:.1f} {y3 - size * 0.35:.1f} H{x + size * 1.2:.1f}" class="nf sc1" stroke-width="{size * 0.4:.1f}"/>')
        out.append(T(x + size * 1.7, y3, L('a section, with its article number', 'раздел с номером статьи'), size, 500, cls='mu'))
        f.add(''.join(out))
        return y3

    if layout in ('wide', 'page'):
        R = (f.bottom - f.top) / 2 - 44
        cx, cy = f.m + R + 44, (f.top + f.bottom) / 2 + 2
        tree_drawing(f, cx, cy, R, 15, 21, 0.85)
        lx = cx + R + 96
        f.add(T(lx, f.top + 14, L('Chapters, with their articles', 'Главы и их статьи'), 21, 500, cls='mu'))
        end = tree_legend(f, lx, f.top + 56, f.w - f.m - lx, 21, 6, two_line=False, ranges=True)
        cut_key(lx, end + 48, 21, f.w - f.m - lx)
    elif layout == 'square':
        R = 250
        cx, cy = f.w / 2, f.top + R + 62
        tree_drawing(f, cx, cy, R, 21, 27, 1.0)
        y = cy + R + 104
        end = tree_legend(f, f.m, y, f.w - 2 * f.m, 22, 12, two_line=False, cols=2, ranges=True)
        f.add(para(f.m, end + 52, L('Grey circle: the cut into chapters. Dark arcs: each chapter’s cut into sections. Ring: the sections, by article number.',
                                   'Серый круг — разрез на главы. Тёмные дуги — разрез глав на разделы. Кольцо — разделы с номерами статей.'), 21, f.w - 2 * f.m, 26, 500, cls='mu')[0])
    else:
        R = 112
        cx, cy = f.w / 2, f.top + R + 34
        tree_drawing(f, cx, cy, R, 13, 13, 0.6)
        y = cy + R + 60
        end = tree_legend(f, f.m, y, f.w - 2 * f.m, 13, 10)
        y3 = cut_key(f.m, end + 30, 13, f.w - 2 * f.m)
        f.used = y3 + 8
    return f



# ----------------------------------------------------------------------------------------------------- 4 fusion
def article_one():
    index, articles = Ctx.data.rec[Ctx.lang]
    return articles[0], Ctx.data.articles[0]


def find_span(text, phrase):
    i = text.find(phrase)
    if i < 0:
        i = text.lower().find(phrase.lower())
    return (i, i + len(phrase)) if i >= 0 else None


def wrap_offsets(text, size, maxw, serif=True, weight=400):
    """Wrap plain text; returns [(line, start offset)] with lines taken verbatim from the text."""
    out, start, line = [], 0, ''
    pos = 0
    for word in text.split(' '):
        trial = (line + ' ' + word) if line else word
        if line and Ctx.meter.width(trial, size, weight, serif) > maxw:
            out.append((line, start))
            start = pos
            line = word
        else:
            line = trial
        pos += len(word) + 1
    out.append((line, start))
    return out


def traced_text(x, y, text, spans, size, maxw, lh, under=4.2, thick=2.4, inference=None, weight=400):
    """Serif text with one coloured line per passage under the words it backs. spans: [(start, end, cls)].
    Overlapping spans stack downwards. inference: (start, end) drawn in the editor's purple. Returns (svg, last baseline)."""
    level = {}
    for k, (a, b, cls) in enumerate(sorted(spans)):
        used = {level[j] for j, (a2, b2, _) in enumerate(sorted(spans)) if j in level and a2 < b and a < b2}
        level[k] = next(n for n in range(10) if n not in used)
    spans = sorted(spans)
    out_lines, out_marks = [], []
    lines = wrap_offsets(text, size, maxw, True, weight)
    for i, (line, start) in enumerate(lines):
        by = y + i * lh
        end = start + len(line)
        px = lambda k: x + Ctx.meter.width(text[start:k], size, weight, True)
        for k, (a, b, cls) in enumerate(spans):
            lo, hi = max(a, start), min(b, end)
            if lo >= hi:
                continue
            x0, x1 = px(lo), px(hi)
            yy = by + under + level[k] * (thick + 1.8)
            out_marks.append(f'<line x1="{x0 + 0.5:.1f}" y1="{yy:.1f}" x2="{x1 - 0.5:.1f}" y2="{yy:.1f}" class="s{cls}" stroke-width="{thick}" stroke-linecap="butt"/>')
        if inference and inference[0] < end and inference[1] > start:
            a, b = max(inference[0], start), min(inference[1], end)
            x0, x1 = px(a), px(b)
            out_marks.append(rrect(x0 - 3, by - size * 0.82, x1 - x0 + 6, size * 1.12, 3, 'etf'))
            seg = (esc(text[start:a]) + f'<tspan class="ef">{esc(text[a:b])}</tspan>' + esc(text[b:end]))
            out_lines.append(f'<text x="{x:.1f}" y="{by:.1f}" font-size="{size:g}" font-weight="{weight}" class="f">{seg}</text>')
        else:
            out_lines.append(T(x, by, line, size, weight, serif=True))
    return ''.join(out_marks) + ''.join(out_lines), y + (len(lines) - 1) * lh, len(lines)


def fusion_items():
    """Article 1's items in the order of its sides: (kind, id, header, text, spans, passages, inference span)."""
    art, art_en = article_one()
    colours = art_en['colors']
    side_of = {}
    for g in art['groups']:
        for it in g['items']:
            side_of[it] = g['name']
    items = []
    for g in art['groups']:
        for it in g['items']:
            claim = next((c for c in art['claims'] if c['id'] == it), None)
            if claim:
                spans = []
                for s_ in claim['support']:
                    for phrase in s_['gives']:
                        sp = find_span(claim['t'], phrase)
                        if sp:
                            spans.append((sp[0], sp[1], f'p{colours[s_["ref"]]}'))
                inf = None
                for x in claim.get('inferences') or []:
                    sp = find_span(claim['t'], x['words'])
                    inf = sp
                spans = sorted(set(spans))
                header = L(f'Claim {claim["number"]} · {g["name"]} · {claim["role"]}', f'Утверждение {claim["number"]} · {g["name"]} · {claim["role"]}')
                items.append(('claim', it, header, claim['t'], spans, claim['passages'], inf))
            else:
                one = next(s_ for s_ in art['single'] if s_['id'] == it)
                header = L(f'Said once · {g["name"]} · {one["ref"]}', f'Сказано однажды · {g["name"]} · {one["ref"]}')
                items.append(('single', it, header, one['t'], [], [one['ref']], None))
    return items


def statement_spans():
    art, art_en = article_one()
    colours = art_en['colors']
    t = art['statement']['t']
    spans = []
    for part in art['statement']['parts']:
        sp = find_span(t, part['words'])
        if sp:
            for ref in part['refs']:
                spans.append((sp[0], sp[1], f'p{colours[ref]}'))
    return t, sorted(set(spans))


def chip(x, y, w, h, ref, cls, size, muted=False):
    if muted:
        return rrect(x, y, w, h, h / 2, 'nf kf', ' stroke-width="2"') + T(x + w / 2, y + h * 0.5 + size * 0.36, ref, size, 700, anchor='middle', cls='mu')
    return (rrect(x, y, w, h, h / 2, f'bg s{cls}', ' stroke-width="2.6"')
            + T(x + w / 2, y + h * 0.5 + size * 0.36, ref, size, 700, anchor='middle'))


def fig_fusion(layout):
    d, v = Ctx.data, Ctx.data.values
    art, art_en = article_one()
    colours = art_en['colors']
    title = L('Fusing a section into an article', 'Как раздел сливается в статью')
    nc, nu = len(set(colours.values())), len(colours)
    hue = L(f'{nc} colours for the {nu} quoted passages: two passages that back the same claim never share one, and the numbers tell the rest apart.',
            f'{nc} цветов на {nu} цитируемых фрагментов: два фрагмента одного утверждения никогда не делят цвет, остальные различают номера.')
    sub = L([f'Article 1, “{art["title"]}”: ', N('a1-members'), ' passages, ', N('a1-claims'), ' fused claims, ', N('a1-single'), ' said once, one statement. ' + hue],
            [f'Статья 1 «{art["title"]}»: ', N('a1-members'), ' фрагментов, ', N('a1-claims'), ' утверждений, ', N('a1-single'), ' — сказано однажды, одно положение. ' + hue])
    if layout in ('wide', 'page'):
        sub = L([f'Article 1, “{art["title"]}”. ' + hue], [f'Статья 1 «{art["title"]}». ' + hue])
    elif layout != 'phone':
        sub = L([f'Article 1, “{art["title"]}”: ', N('a1-members'), ' passages, ', N('a1-claims'), ' fused claims, ', N('a1-single'), f' said once. {nc} colours for {nu} passages; two that back one claim never share one.'],
                [f'Статья 1 «{art["title"]}»: ', N('a1-members'), ' фрагментов, ', N('a1-claims'), ' утверждений, ', N('a1-single'), f' — сказано однажды. {nc} цветов на {nu} фрагментов; у двух фрагментов одного утверждения цвета разные.'])
    desc = L(f"Article 1: {v['a1-members']} passages on the left feed {v['a1-claims']} fused claims; coloured lines under the words show which passages back them ({nc} colours for {nu} quoted passages, never the same colour for two passages of one claim; the passage numbers tell them apart); two points said once by a single passage stand apart; the claims are gathered into the statement “{art['statement']['t']}” The word “because” in claim 5 is the editor's inference, in purple.",
             f"Статья 1: {v['a1-members']} фрагментов слева питают {v['a1-claims']} утверждений; цветные линии под словами показывают, какие фрагменты их подкрепляют ({nc} цветов на {nu} цитируемых фрагментов, у двух фрагментов одного утверждения цвета всегда разные; различают их номера); два пункта сказаны однажды одним фрагментом; утверждения собраны в положение «{art['statement']['t']}» Слова «потому что» в утверждении 5 — вывод редактора, фиолетовым.")
    f = Fig('fusion', 4, layout, title, sub, desc)
    items = fusion_items()
    members = art['members']
    stmt, stmt_spans = statement_spans()
    inf_label = L('the editor’s inference', 'вывод редактора')

    if layout in ('wide', 'square'):
        sq = layout == 'square'
        cs = 22 if sq else 16          # claim text
        hs = 21 if sq else 15          # item header
        lh = cs * (1.56 if sq else 1.5)
        chip_w, chip_h, chip_s = (104, 36, 21) if sq else (80, 27, 16)
        if not sq:
            items = [it for it in items if it[0] == 'claim']
        cx0 = f.m
        tx = f.m + chip_w + (150 if sq else 112)
        tw_max = (f.w - f.m - tx) if sq else 640
        art_single = art['single']
        once = L('Said once, kept apart: ', 'Сказано однажды, отдельно: ') + '; '.join(f'{x["ref"]} ({x["label"].lower()})' for x in art_single)

        def lay_items(cs, hs, lh, gap=0.72):
            out, ports, y = [], {}, f.top + (8 if sq else 4)
            for kind, iid, header, text, spans, passages, inf in items:
                out.append(T(tx, y + hs, header, hs, 650, cls='mu'))
                body, last, nlines = traced_text(tx, y + hs + (10 if sq else 8) + cs, text, spans, cs, tw_max, lh, under=cs * 0.2, thick=2.6 if sq else 2.2, inference=inf)
                out.append(body)
                if inf:
                    out.append(T(tx + tw_max, y + hs, inf_label, hs, 650, anchor='end', cls='ef'))
                ports[iid] = (y + hs * 0.4, last + cs * 0.4, passages, kind)
                y = last + cs * 0.55 + (cs * gap if sq else cs * 0.5)
            return out, ports, y

        if sq:
            # the items, then the statement box, all above the credit's clear space; the gaps close up only as far as they must
            stmt_lines = len(wrap_offsets(stmt, 28, f.w - f.m - tx - 6))
            stmt_h = 22 + 18 + 28 + (stmt_lines - 1) * 28 * 1.5 + 26
            for lh_k, gap in ((1.56, 0.72), (1.52, 0.6), (1.48, 0.5), (1.44, 0.42)):
                body_parts, ports, items_bottom = lay_items(cs, hs, cs * lh_k, gap)
                if items_bottom + 4 - 8 + stmt_h <= f.bottom:
                    break
        else:
            # the landscape image: the claims, then the said-once line on a row of its own, all clear of the credit;
            # the type steps down only as far as it must
            for cs in (16, 15.5, 15, 14.5, 14):
                hs, lh = cs - 1, cs * 1.45
                body_parts, ports, items_bottom = lay_items(cs, hs, lh)
                once_lines = len(wrap(once, 15, tw_max, 600))
                once_y = items_bottom + 4
                if once_y + 15 + (once_lines - 1) * 19 <= f.bottom - 8:
                    break
        for part in body_parts:
            f.add(part)
        # chips, spread over the items' height, in the record's order of closeness
        n = len(members)
        span_top, span_bot = f.top + 6, (items_bottom - cs * 0.8 if sq else f.bottom - chip_h)
        step = (span_bot - span_top - chip_h) / (n - 1)
        chip_y = {}
        for k, m in enumerate(members):
            cy = span_top + k * step
            chip_y[m['ref']] = cy + chip_h / 2
            f.add(chip(cx0, cy, chip_w, chip_h, m['ref'], f'p{colours.get(m["ref"], 1)}', chip_s, muted=not m['used']))
            if not m['used']:
                f.add(T(cx0 + chip_w + 8, cy + chip_h / 2 + chip_s * 0.36, L('set aside', 'отложен'), chip_s, 600, cls='mu halo'))
        # curves from each passage to each item it feeds
        curves = []
        for iid, (top_y, bot_y, passages, kind) in ports.items():
            k = len(passages)
            for j, ref in enumerate(passages):
                ty = top_y + (bot_y - top_y) * (j + 1) / (k + 1)
                sy = chip_y[ref]
                x1, x2 = cx0 + chip_w + 2, tx - 14
                cls = f'sp{colours[ref]}'
                curves.append(f'<path d="M{x1:.1f} {sy:.1f} C{x1 + (x2 - x1) * 0.55:.1f} {sy:.1f} {x2 - (x2 - x1) * 0.45:.1f} {ty:.1f} {x2:.1f} {ty:.1f}" class="nf {cls}" stroke-width="{2.2 if sq else 1.8}" opacity=".9"/>')
            f.add(f'<line x1="{tx - 10:.1f}" y1="{top_y:.1f}" x2="{tx - 10:.1f}" y2="{bot_y:.1f}" class="{"kl" if kind == "claim" else "kf"}" stroke-width="3" stroke-linecap="round"/>')
        f.body.insert(0, ''.join(curves))
        # the statement
        if sq:
            sy = items_bottom + 4
            ss = 28
            n_st = len(wrap_offsets(stmt, ss, f.w - f.m - tx - 6))
            box_h = 22 + 18 + ss + (n_st - 1) * ss * 1.5 + 26
            f.add(rrect(tx - 22, sy - 8, f.w - f.m - tx + 32, box_h, 10, 'nf k', ' stroke-width="1.4"'))
            f.add(T(tx, sy + 22, L('The statement · gathers claims 1 and 2', 'Положение · собирает утверждения 1 и 2'), 21, 650, cls='mu'))
            body, last, _ = traced_text(tx, sy + 22 + 16 + ss, stmt, stmt_spans, ss, f.w - f.m - tx - 6, ss * 1.5, under=6, thick=3)
            f.add(body)
        else:
            sx = tx + tw_max + 40
            sw = f.w - f.m - sx
            ss = 21
            n_st = len(wrap_offsets(stmt, ss, sw - 14))
            box_h = 50 + ss + (n_st - 1) * ss * 1.55 + 46
            f.add(rrect(sx - 16, f.top - 2, sw + 16, box_h, 10, 'nf k', ' stroke-width="1.4"'))
            f.add(T(sx, f.top + 22, L('The statement', 'Положение'), 16, 650, cls='mu'))
            body, last, _ = traced_text(sx, f.top + 58, stmt, stmt_spans, ss, sw - 14, ss * 1.55, under=5, thick=2.4)
            f.add(body)
            f.add(T(sx, last + 36, L('gathers claims 1 and 2', 'собирает утв. 1 и 2'), 16, 600, cls='mu'))
            f.add(para(tx, once_y + 15, once, 15, tw_max, 19, 600, cls='mu')[0])
            # key
            ky = f.top + box_h + 32
            f.add(T(sx, ky, L('How to read it', 'Как читать'), 16, 700))
            key = L(['A coloured line under words: a passage that says them; its curve leads to the number.'],
                    ['Цветная линия под словами — фрагмент, который их говорит; кривая ведёт к номеру.'])
            f.add(para(sx, ky + 24, key, 16, sw - 4, 20, cls='mu')[0])
    else:
        # phone: chips on top, items under them, the statement at the end
        cs, hs, lh = 15, 12.5, 25
        chip_w, chip_h = 58, 24
        cols = 5
        gap = (f.w - 2 * f.m - cols * chip_w) / (cols - 1)
        y = f.top
        for k, m in enumerate(members):
            r_, c_ = divmod(k, cols)
            f.add(chip(f.m + c_ * (chip_w + gap), y + r_ * (chip_h + 8), chip_w, chip_h, m['ref'], f'p{colours.get(m["ref"], 1)}', 13, muted=not m['used']))
        y += 2 * (chip_h + 8) + 6
        s_, n_, last = para(f.m, y + 13, L(['Grey: set aside (8.52). Under each claim: the passages it is fused from.'], ['Серый — отложен (8.52). Под каждым утверждением — фрагменты, из которых оно слито.']), 13, f.w - 2 * f.m, 17, cls='mu')
        f.add(s_)
        y = last + 22
        for kind, iid, header, text, spans, passages, inf in items:
            s_, n_, hl = para(f.m, y + 13, header, 13, f.w - 2 * f.m, 16, 650, cls='mu')
            f.add(s_)
            dx = f.m
            dy = hl + 10
            for ref in passages:
                wdt = tw(ref, 13, 700) + 16
                f.add(rrect(dx, dy, wdt, 20, 10, f'bg sp{colours[ref]}', ' stroke-width="2"'))
                f.add(T(dx + wdt / 2, dy + 14.5, ref, 13, 700, anchor='middle'))
                dx += wdt + 5
            body, last, _ = traced_text(f.m, dy + 20 + 10 + cs, text, spans, cs, f.w - 2 * f.m, lh, under=3.4, thick=2, inference=inf)
            f.add(body)
            if inf:
                last += 24
                f.add(T(f.m, last, L('Purple: the editor’s inference', 'Фиолетовым — вывод редактора'), 13, 650, cls='ef'))
            y = last + 24
        f.add(chev_down(f.w / 2, y, 6))
        y += 14
        ss = 19
        lines = len(wrap_offsets(stmt, ss, f.w - 2 * f.m - 20))
        box_h = 40 + lines * ss * 1.55 + 10
        f.add(rrect(f.m, y, f.w - 2 * f.m, box_h, 10, 'nf k', ' stroke-width="1.3"'))
        f.add(T(f.m + 12, y + 24, L('The statement · gathers claims 1 and 2', 'Положение · собирает утв. 1 и 2'), 13, 650, cls='mu'))
        body, last, _ = traced_text(f.m + 12, y + 30 + ss + 6, stmt, stmt_spans, ss, f.w - 2 * f.m - 24, ss * 1.55, under=4, thick=2.4)
        f.add(body)
        f.used = y + box_h + 6
    return f


# ----------------------------------------------------------------------------------------------------- 5 sides
SIDES = ['why', 'action', 'practice', 'breaks', 'doubt']


def side_meta():
    index, articles = Ctx.data.rec[Ctx.lang]
    labels = {l['key']: l for l in index['labels']}
    return labels, articles


def fig_sides(layout):
    d, v = Ctx.data, Ctx.data.values
    labels, articles = side_meta()
    title = L('One statement, five sides', 'Одно положение, пять сторон')
    sub = L('Every article looks at its statement from the same five sides; a dot is a side with something in it, a ring a side left empty with a reason.',
            'Каждая статья смотрит на своё положение с одних и тех же пяти сторон; точка — сторона, в которой что-то есть, кольцо — сторона, оставленная пустой с объяснением.')
    desc = L('A grid of ' + str(v['articles']) + ' articles by five sides. Filled in: ' + ', '.join(f"{labels[k]['name']} {v['fill-' + k]}" for k in SIDES) + '.',
             'Сетка: ' + str(v['articles']) + ' статей на пять сторон. Заполнено: ' + ', '.join(f"{labels[k]['name']} {v['fill-' + k]}" for k in SIDES) + '.')
    f = Fig('sides', 5, layout, title, sub, desc)
    counts = {(a['number'], g['key']): len(g['items']) for a in articles for g in a['groups']}
    empty_why = {(a['number'], g['key']): g.get('empty', '') for a in articles for g in a['groups']}
    biggest = max(counts.values())
    chapters = d.chapters
    groups = [[d.section_article[s['id']] for s in c['sections']] for c in chapters]

    def dot(cx, cy, n, rmax, number, key):
        tip = f"{L('Article', 'Статья')} {number} · {labels[key]['name']}: " + (str(n) if n else (empty_why[(number, key)] or '0'))
        if n:
            r = max(2.2, rmax * math.sqrt(n / biggest))
            return hover(tip, f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" class="ink"/>')
        return hover(tip, f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rmax * 0.36:.1f}" class="nf km" stroke-width="1.2"/>')

    of = lambda key: L([N(f'fill-{key}'), ' of ', N('articles')], [N(f'fill-{key}'), ' из ', N('articles')])

    def size_key(x, y, rmax, fs, cls='mu'):
        """The key to the dots: area by the number of items, and the ring. y is the text baseline."""
        out, cx = [], x
        lead = L('Dot area: items in the side', 'Площадь точки — число пунктов')
        out.append(T(cx, y, lead, fs, 600, cls=cls))
        cx += tw(lead, fs, 600) + fs * 0.8
        cy = y - fs * 0.36
        for n in (1, biggest):
            r = max(2.2, rmax * math.sqrt(n / biggest))
            out.append(f'<circle cx="{cx + r:.1f}" cy="{cy:.1f}" r="{r:.1f}" class="ink"/>')
            cx += 2 * r + fs * 0.3
            out.append(T(cx, y, str(n), fs, 700, cls=cls))
            cx += tw(str(n), fs, 700) + fs * 0.8
        rr = rmax * 0.36
        out.append(f'<circle cx="{cx + rr:.1f}" cy="{cy:.1f}" r="{rr:.1f}" class="nf km" stroke-width="1.2"/>')
        cx += 2 * rr + fs * 0.3
        ring = L('empty, with a reason', 'пусто, с объяснением')
        out.append(T(cx, y, ring, fs, 600, cls=cls))
        return ''.join(out), cx + tw(ring, fs, 600) - x

    def fit_title(text, size, maxw):
        """The title at one size; cut at a word with an ellipsis when it is too long."""
        if tw(text, size, 500) <= maxw:
            return text
        words = text.split()
        while words and tw(' '.join(words) + '…', size, 500) > maxw:
            words.pop()
        return ' '.join(words).rstrip(',;:') + '…'

    if layout in ('wide', 'page'):
        lx, lw = f.m, 372
        cw_x = f.m + lw + 18
        count_w = 112
        mx1 = f.w - f.m - count_w - 10
        gapc = 10
        col = (mx1 - cw_x - gapc * (len(chapters) - 1)) / v['articles']
        head_h = 44
        rows_top = f.top + head_h
        key_h = 40
        rh = (f.bottom - key_h - rows_top) / 5
        rmax = min(col, rh) / 2 - 0.6
        f.add(size_key(cw_x, f.bottom - 10, rmax, 21)[0])
        # chapter heads
        x = cw_x
        for c, arts in zip(chapters, groups):
            w = len(arts) * col
            cls = chapter_cls(c['id'])
            f.add(f'<line x1="{x + 2:.1f}" y1="{f.top + 26:.1f}" x2="{x + w - 2:.1f}" y2="{f.top + 26:.1f}" class="s{cls}" stroke-width="4" stroke-linecap="round"/>')
            f.add(T(x + w / 2, f.top + 14, str(d.chapter_no[c['id']]), 21, 750, anchor='middle', cls='mu'))
            x += w + gapc
        f.add(T(lx, f.top + 14, L('Chapters, articles 1 to 38 →', 'Главы, статьи с 1 по 38 →'), 21, 600, cls='mu'))
        for i, key in enumerate(SIDES):
            ry = rows_top + i * rh
            if i:
                f.add(f'<line x1="{f.m:.1f}" y1="{ry:.1f}" x2="{f.w - f.m:.1f}" y2="{ry:.1f}" class="kl" stroke-width="1"/>')
            f.add(T(lx, ry + 28, labels[key]['name'], 23, 750))
            q = labels[key]['asks']
            if layout == 'wide':      # the share image: one line, smaller if it must be
                qs = 21
                while qs > 15 and tw(q, qs) > lw:
                    qs -= 0.5
                f.add(para(lx, ry + 54, q, qs, lw, qs * 1.1, cls='mu')[0])
            else:
                f.add(para(lx, ry + 54, q, 21, lw, 23, cls='mu')[0])
            x = cw_x
            cy = ry + rh / 2 + 2
            for arts in groups:
                for n_ in arts:
                    f.add(dot(x + col / 2, cy, counts[(n_, key)], rmax, n_, key))
                    x += col
                x += gapc
            f.add(T(f.w - f.m, cy + 8, of(key), 23, 700, anchor='end'))
    elif layout == 'square':
        num_w, title_w = 44, 400
        cw_x = f.m + num_w + title_w + 20
        cols_w = (f.w - f.m - cw_x) / 5
        head_h = 98
        top = f.top + head_h
        gapr = 7
        rh = (f.bottom - top - gapr * (len(chapters) - 1)) / v['articles']
        rmax = min(rh, cols_w) / 2 - 1.2
        for j, key in enumerate(SIDES):
            hx = cw_x + j * cols_w + cols_w / 2
            lines = wrap(labels[key]['name'], 21, cols_w - 8, 750)
            base = f.top + 30 - (len(lines) - 1) * 24
            for k, ln in enumerate(lines):
                f.add(T(hx, base + k * 24 + 12, ln, 21, 750, anchor='middle'))
            f.add(T(hx, f.top + 76, of(key), 19, 600, anchor='middle', cls='mu'))
        # the key, in the empty corner above the titles: two lines, so it never runs into the column heads
        kfs = 19
        lead = L('Dot area: items in the side', 'Площадь точки — число пунктов')
        f.add(T(f.m, f.top + 40, lead, kfs, 600, cls='mu'))
        kx, ky = f.m, f.top + 76
        for n in (1, biggest):
            r = max(2.2, rmax * math.sqrt(n / biggest))
            f.add(f'<circle cx="{kx + r:.1f}" cy="{ky - kfs * 0.36:.1f}" r="{r:.1f}" class="ink"/>')
            kx += 2 * r + 6
            f.add(T(kx, ky, str(n), kfs, 700, cls='mu'))
            kx += tw(str(n), kfs, 700) + 16
        rr = rmax * 0.36
        f.add(f'<circle cx="{kx + rr:.1f}" cy="{ky - kfs * 0.36:.1f}" r="{rr:.1f}" class="nf km" stroke-width="1.2"/>')
        f.add(T(kx + 2 * rr + 6, ky, L('empty, with a reason', 'пусто, с объяснением'), kfs, 600, cls='mu'))
        y = top
        for c, arts in zip(chapters, groups):
            cls = chapter_cls(c['id'])
            f.add(f'<line x1="{f.m + 4:.1f}" y1="{y + 3:.1f}" x2="{f.m + 4:.1f}" y2="{y + len(arts) * rh - 3:.1f}" class="s{cls}" stroke-width="5" stroke-linecap="round"/>')
            for n_ in arts:
                art = next(a for a in articles if a['number'] == n_)
                cy = y + rh / 2
                f.add(T(f.m + num_w, cy + 6.5, str(n_), 18, 700, anchor='end'))
                f.add(T(f.m + num_w + 12, cy + 18 * 0.36, fit_title(art['title'], 18, title_w), 18, 500, cls='mu'))
                for j, key in enumerate(SIDES):
                    f.add(dot(cw_x + j * cols_w + cols_w / 2, cy, counts[(n_, key)], rmax, n_, key))
                y += rh
            y += gapr
    else:
        num_w = 30
        cw_x = f.m + num_w + 8
        cols_w = (f.w - f.m - cw_x) / 5
        head_h = 118
        top = f.top + head_h
        gapr = 5
        rh = 15.5
        rmax = rh / 2 - 0.6
        for j, key in enumerate(SIDES):
            hx = cw_x + j * cols_w + cols_w / 2
            f.add(f'<g transform="translate({hx - 2:.1f} {top - 30:.1f}) rotate(-62)">' + T(0, 0, labels[key]['name'], 13, 700) + '</g>')
            f.add(T(hx, top - 10, [N(f'fill-{key}')], 13, 700, anchor='middle', cls='mu'))
        y = top
        for c, arts in zip(chapters, groups):
            cls = chapter_cls(c['id'])
            f.add(f'<line x1="{f.m + 2:.1f}" y1="{y + 2:.1f}" x2="{f.m + 2:.1f}" y2="{y + len(arts) * rh - 2:.1f}" class="s{cls}" stroke-width="4" stroke-linecap="round"/>')
            for n_ in arts:
                cy = y + rh / 2
                f.add(T(f.m + num_w, cy + 4.6, str(n_), 13, 600, anchor='end', cls='mu'))
                for j, key in enumerate(SIDES):
                    f.add(dot(cw_x + j * cols_w + cols_w / 2, cy, counts[(n_, key)], rmax, n_, key))
                y += rh
            y += gapr
        y += 10
        s1, n1, last = para(f.m, y + 13, L(['Numbers under the names: articles that fill the side, of ', N('articles'), '. Dot area: the number of items in the side.'],
                                         ['Числа под названиями — сколько из ', N('articles'), ' статей заполняют сторону. Площадь точки — число пунктов на стороне.']), 13, f.w - 2 * f.m, 17, cls='mu')
        f.add(s1)
        y = last + 24
        kx = f.m
        for n in (1, biggest):
            r = max(2.2, rmax * math.sqrt(n / biggest))
            f.add(f'<circle cx="{kx + r:.1f}" cy="{y - 4.6:.1f}" r="{r:.1f}" class="ink"/>')
            kx += 2 * r + 4
            f.add(T(kx, y, L(f'{n} item' + ('s' if n > 1 else ''), f'{n} {ru_plural(n, "пункт", "пункта", "пунктов")}'), 13, 600, cls='mu'))
            kx += tw(L(f'{n} items', f'{n} пунктов'), 13, 600) + 12
        rr = rmax * 0.36
        f.add(f'<circle cx="{kx + rr:.1f}" cy="{y - 4.6:.1f}" r="{rr:.1f}" class="nf km" stroke-width="1.2"/>')
        f.add(T(kx + 2 * rr + 4, y, L('empty, with a reason', 'пусто, с объяснением'), 13, 600, cls='mu'))
        f.used = y + 8
    return f


# ----------------------------------------------------------------------------------------------------- 6 Seneca
EFFECTS = [('stronger', 'fb'), ('wider', 'fa'), ('qualified', 'fl')]


def effect_names():
    index = Ctx.data.rec[Ctx.lang][0]
    return {e['key']: e['name'] for e in index['effects']}


def seneca_strip(f, x, y, w, h, size, legend=True):
    d, v = Ctx.data, Ctx.data.values
    names = effect_names()
    arts = Ctx.data.articles
    chapters = d.chapters
    groups = [[d.section_article[s['id']] for s in c['sections']] for c in chapters]
    gap = 8 if w > 400 else 5
    col = (w - size * 1.7 - gap * (len(chapters) - 1)) / len(arts)
    bw = max(col - 2, 2)
    top = y
    if legend:
        lx = x
        for key, cls in EFFECTS:
            label = [names[key], ' ', N({'stronger': 'seneca-backs', 'wider': 'seneca-adds', 'qualified': 'seneca-limits'}[key])]
            if lx > x and lx + size * 1.15 + tw(label, size, 650) > x + w:
                lx, top = x, top + size * 1.4
            f.add(rrect(lx, top - size * 0.78, size * 0.8, size * 0.8, 2, cls))
            f.add(T(lx + size * 1.15, top, label, size, 650))
            lx += size * 1.15 + tw(label, size, 650) + size * 1.1
        top += size * 1.4
    base = y + h - size * 1.7
    peak = max(sum(a['voices']['seneca']['counts'][k] for k, _ in EFFECTS) for a in arts)
    scale = (base - top - 6) / peak
    ax = x + size * 1.7
    for t in range(0, peak + 1, 5):
        ty = base - t * scale
        f.add(f'<line x1="{ax:.1f}" y1="{ty:.1f}" x2="{x + w:.1f}" y2="{ty:.1f}" class="kl" stroke-width="1"/>')
        f.add(T(ax - 8, ty + size * 0.33, str(t), size, 500, anchor='end', cls='mu'))
    cx = ax
    for c, nums in zip(chapters, groups):
        x0 = cx
        for n_ in nums:
            a = arts[n_ - 1]
            counts = a['voices']['seneca']['counts']
            yy = base
            stack = [(k, cls, counts[k]) for k, cls in EFFECTS if counts[k]]
            tip = f"{L('Article', 'Статья')} {n_}: " + ' · '.join(f'{names[k]} {counts[k]}' for k, _ in EFFECTS)
            parts = []
            for i, (k, cls, n) in enumerate(stack):
                hgt = n * scale
                last = i == len(stack) - 1
                if last:
                    parts.append(bar_up(cx + (col - bw) / 2, yy, bw, hgt - (0 if i == 0 else 0), 2, cls))
                else:
                    parts.append(rrect(cx + (col - bw) / 2, yy - hgt, bw, hgt - 1.5, 0, cls))
                yy -= hgt
            f.add(hover(tip, ''.join(parts)))
            cx += col
        f.add(T((x0 + cx) / 2, base + size * 1.3, str(d.chapter_no[c['id']]), size, 700, anchor='middle', cls='mu'))
        f.add(f'<line x1="{x0 + 1:.1f}" y1="{base + 4:.1f}" x2="{cx - 1:.1f}" y2="{base + 4:.1f}" class="km" stroke-width="2" stroke-linecap="round"/>')
        cx += gap
    return base


def seneca_steps():
    names = effect_names()
    return [
        (L('A corpus to search', 'Корпус для поиска'),
         L([N('seneca-corpus'), ' passages of all ', N('seneca-letters-all'), ' letters, in Gummere’s English, used only for finding'],
           [N('seneca-corpus'), ' фрагментов из всех ', N('seneca-letters-all'), ' писем, в английском Гаммера, только для поиска'])),
        (L('Vectors and words', 'Векторы и слова'),
         L(['Ranked by closeness to each section; at least three logged searches by its key words'],
           ['Ранжированы по близости к каждому разделу; не меньше трёх записанных поисков по его ключевым словам'])),
        (L('Read in context', 'Чтение в контексте'),
         L(['The letter around each quote is read; one sentence says what it is about'],
           ['Письмо вокруг каждой цитаты прочитано; одно предложение говорит, о чём оно'])),
        (L('Placed', 'Размещение'),
         L([N('seneca-items'), ' items: each ', names['stronger'], ', ', names['wider'], ' or ', names['qualified'], '; ', N('seneca-pieces'), ' quotes from ', N('letters'), ' letters'],
           [N('seneca-items'), rp('seneca-items', ' вклад: каждый ', ' вклада: каждый ', ' вкладов: каждый '), names['stronger'].lower(), ', ', names['wider'].lower(), ' или ', names['qualified'].lower(), '; ', N('seneca-pieces'), ' цитата из ', N('letters'), ' писем'])),
        (L('Clauses in the body', 'Приписки в тексте'),
         L([N('clauses'), ': ', N('clauses-adds'), ' add, ', N('clauses-limits'), ' limit, ', N('clauses-challenges'), ' challenge; Marcus’s words are never rewritten'],
           [N('clauses'), ': ', N('clauses-adds'), ' добавляют, ', N('clauses-limits'), ' ограничивают, ', N('clauses-challenges'), ' возражают; слова Марка не переписываются'])),
    ]


def step_list(f, x, y, w, ts, ds, gap, steps, numbered=True):
    for i, (head, body) in enumerate(steps):
        r = ts * 0.72
        if numbered:
            f.add(f'<circle cx="{x + r:.1f}" cy="{y - ts * 0.34:.1f}" r="{r:.1f}" class="ink"/>')
            f.add(T(x + r, y - ts * 0.02, str(i + 1), ts * 0.96, 800, anchor='middle', cls='bg'))
        tx = x + (r * 2 + ts * 0.5 if numbered else 0)
        f.add(T(tx, y, head, ts, 750))
        s_, n_, last = para(tx, y + ds * 1.35, body, ds, w - (tx - x), ds * 1.28, cls='mu')
        f.add(s_)
        if numbered and i < len(steps) - 1:
            f.add(f'<line x1="{x + r:.1f}" y1="{y + ts * 0.5:.1f}" x2="{x + r:.1f}" y2="{last + gap - ts * 1.2:.1f}" class="kl" stroke-width="2"/>')
        y = last + gap
    return y


def fig_seneca(layout):
    d, v = Ctx.data, Ctx.data.values
    title = L('Seneca as a second voice', 'Сенека как второй голос')
    sub = L(['How his passages were found and placed: ', N('seneca-items'), ' items in ', N('articles'), ' articles, each one Backs, Adds or Limits Marcus.'],
            ['Как его фрагменты найдены и размещены: ', N('seneca-items'), rp('seneca-items', ' вклад в ', ' вклада в ', ' вкладов в '), N('articles'), ' статьях, каждый подкрепляет, добавляет или ограничивает Марка.'])
    desc = L(f"Five steps, from a search corpus of {v['seneca-corpus']} passages to {v['seneca-items']} placed items and {v['clauses']} clauses; a stacked column per article shows Backs ({v['seneca-backs']}), Adds ({v['seneca-adds']}) and Limits ({v['seneca-limits']}).",
             f"Пять шагов: от корпуса из {v['seneca-corpus']} фрагментов к {v['seneca-items']} вкладам и {v['clauses']} {ru_plural(v['clauses'], 'приписке', 'припискам', 'припискам')}; столбик на статью показывает «Подкрепляет» ({v['seneca-backs']}), «Добавляет» ({v['seneca-adds']}) и «Ограничивает» ({v['seneca-limits']}).")
    f = Fig('seneca', 6, layout, title, sub, desc)
    steps = seneca_steps()
    strip_title = L('Items per article', 'Вклады по статьям')
    if layout in ('wide', 'page'):
        lw = 492
        if layout == 'page':
            step_list(f, f.m, f.top + 18, lw, 22, 21, 30, steps)
        else:      # the share image: a little smaller so the Russian fits
            step_list(f, f.m, f.top + 16, lw, 20, 17, 27, steps)
        sx = f.m + lw + 44
        f.add(T(sx, f.top + 18, strip_title, 22, 750))
        seneca_strip(f, sx, f.top + 58, f.w - f.m - sx, f.bottom - f.top - 58 + 8, 21)
    elif layout == 'square':
        y = step_list(f, f.m, f.top + 24, f.w - 2 * f.m, 26, 23, 44, steps)
        f.add(T(f.m, y + 4, strip_title, 25, 750))
        seneca_strip(f, f.m, y + 48, f.w - 2 * f.m, f.bottom - y - 30, 22)
    else:
        y = step_list(f, f.m, f.top + 14, f.w - 2 * f.m, 14, 13, 22, steps)
        f.add(T(f.m, y + 6, strip_title, 14, 750))
        base = seneca_strip(f, f.m, y + 34, f.w - 2 * f.m, 210, 13)
        f.used = base + 30
    return f


# ----------------------------------------------------------------------------------------------------- 7 translation
def lanes():
    return [
        ('marcus', L('Greek → English', 'Греческий → английский'),
         L([N('tr-marcus'), ' passages of Marcus'], [N('tr-marcus'), ' ' + ru_plural(Ctx.data.values['tr-marcus'], 'фрагмент', 'фрагмента', 'фрагментов') + ' Марка']), 'Claude Fable 5.2',
         [(L('Translator', 'Переводчик'), L('sees the Greek', 'видит греческий')),
          (L('Checker', 'Проверяющий'), L('the Greek and the English', 'греческий и английский')),
          (L('Settler', 'Решающий'), L('Greek, draft and points', 'греческий, черновик, замечания'))],
         L([N('dec-marcus-found'), ' of the accepted are faults the settler found itself · ', N('notes-marcus'), ' notes on what the Greek leaves open'],
           [N('dec-marcus-found'), ' из принятых — ошибки, найденные самим решающим · ', N('notes-marcus'), ' заметок о том, что греческий оставляет открытым'])),
        ('seneca', L('Latin → English', 'Латынь → английский'),
         L([N('tr-seneca'), ' sections of Seneca, ', N('tr-letters'), ' letters'],
           [N('tr-seneca'), ' ' + ru_plural(Ctx.data.values['tr-seneca'], 'раздел', 'раздела', 'разделов') + ' Сенеки, ', N('tr-letters'), ' ' + ru_plural(Ctx.data.values['tr-letters'], 'письмо', 'письма', 'писем')]), 'Claude Fable 5.2',
         [(L('Translator', 'Переводчик'), L('sees the Latin', 'видит латынь')),
          (L('Checker', 'Проверяющий'), L('the Latin and the English', 'латынь и английский')),
          (L('Settler', 'Решающий'), L('Latin, draft and points', 'латынь, черновик, замечания'))],
         L([N('dec-seneca-found'), ' of the accepted are faults the settler found itself · ', N('notes-seneca'), ' notes on what the Latin leaves open'],
           [N('dec-seneca-found'), ' из принятых — ошибки, найденные самим решающим · ', N('notes-seneca'), ' заметок о том, что латынь оставляет открытым'])),
        ('ru', L('English → Russian', 'Английский → русский'),
         L([N('tr-ru'), ' passages, Marcus and Seneca'], [N('tr-ru'), ' ' + ru_plural(Ctx.data.values['tr-ru'], 'фрагмент', 'фрагмента', 'фрагментов') + ', Марк и Сенека']), 'Claude Opus 5.5 · Sonnet 5.5',
         [(L('Translator', 'Переводчик'), L('Opus, sees the English', 'Opus, видит английский')),
          (L('Second reader', 'Второй читатель'), L('Sonnet, English and Russian', 'Sonnet, оба текста')),
          (L('Translator settles', 'Переводчик'), L('each point in writing', 'решает письменно'))],
         L(['Every quote of the articles cut again from the Russian; a glossary fixes the page’s terms'],
           ['Каждая цитата статей вырезана заново из русского; глоссарий закрепляет термины страницы'])),
    ]


DEC = [('accepted', 'd1'), ('partly', 'd2'), ('declined', 'd3'), ('free', 'd4')]


def dec_names():
    return {'accepted': L('accepted', 'принято'), 'partly': L('partly', 'частично'), 'declined': L('declined', 'отклонено'),
            'free': L('free form', 'свободно')}


def dec_bar(f, x, y, w, h, name, scale):
    v = Ctx.data.values
    xx = x
    for kind, cls in DEC:
        n = v[f'dec-{name}-{kind}']
        if not n:
            continue
        ww = n * scale
        f.add(f'<rect x="{xx:.1f}" y="{y:.1f}" width="{max(ww - 2, 1):.1f}" height="{h}" rx="2" class="{cls}"><title>{esc(dec_names()[kind])}: {n}</title></rect>')
        xx += ww
    return xx


def dec_labels(f, x, y, w, size, name):
    v = Ctx.data.values
    names = dec_names()
    xx, yy = x, y
    for kind, cls in DEC:
        if not v[f'dec-{name}-{kind}']:
            continue
        part = [N(f'dec-{name}-{kind}'), ' ' + names[kind]]
        ww = size * 1.05 + tw(part, size, 600)
        if xx > x and xx + ww > x + w:
            xx, yy = x, yy + size * 1.4
        f.add(rrect(xx, yy - size * 0.75, size * 0.72, size * 0.72, 2, cls))
        f.add(T(xx + size * 1.0, yy, part, size, 600))
        xx += ww + size * 0.9
    return yy


def fig_translation(layout):
    d, v = Ctx.data, Ctx.data.values
    title = L('Three readings for every passage', 'Три прочтения для каждого фрагмента')
    sub = L('Greek and Latin into today’s English, then into Russian. Every point of the second reader is settled in writing: by a third reader in a fresh context, or, for the Russian, by the translator.',
            'Греческий и латынь — на современный английский, затем на русский. Каждое замечание второго читателя решается письменно: третьим читателем в новом контексте, а для русского — переводчиком.')
    desc = L(f"Three lanes. Greek to English: {v['tr-marcus']} passages, points settled {v['dec-marcus-accepted']} accepted, {v['dec-marcus-partly']} partly, {v['dec-marcus-declined']} declined. Latin to English: {v['tr-seneca']} sections, {v['dec-seneca-accepted']}, {v['dec-seneca-partly']}, {v['dec-seneca-declined']}. English to Russian: {v['tr-ru']} passages, {v['dec-ru-accepted']}, {v['dec-ru-partly']}, {v['dec-ru-declined']}.",
             f"Три дорожки. С греческого на английский: {v['tr-marcus']} фрагментов, замечания: {v['dec-marcus-accepted']} принято, {v['dec-marcus-partly']} частично, {v['dec-marcus-declined']} отклонено. С латыни: {v['tr-seneca']} {ru_plural(v['tr-seneca'], 'раздел', 'раздела', 'разделов')}, {v['dec-seneca-accepted']}, {v['dec-seneca-partly']}, {v['dec-seneca-declined']}. С английского на русский: {v['tr-ru']} фрагмента, {v['dec-ru-accepted']}, {v['dec-ru-partly']}, {v['dec-ru-declined']}.")
    f = Fig('translation', 7, layout, title, sub, desc)
    peak = max(v[f'dec-{n}-total'] for n in ('marcus', 'seneca', 'ru'))
    if layout == 'square':
        ls, ss = 27, 22
        lane_h = (f.bottom - f.top) / 3
        width = f.w - 2 * f.m
        scale = width / peak
        for i, (name, head, units, model, readers, extra) in enumerate(lanes()):
            y = f.top + i * lane_h
            if i:
                f.add(f'<line x1="{f.m:.1f}" y1="{y - 10:.1f}" x2="{f.w - f.m:.1f}" y2="{y - 10:.1f}" class="kl" stroke-width="1"/>')
            f.add(T(f.m, y + ls, head, ls, 750))
            hw = tw(head, ls, 750)
            f.add(T(f.m + hw + 16, y + ls, units + [' · ' + model], ss, 500, cls='mu'))
            k = len(readers)
            gapn = 30
            # each box as wide as its words need, the spare width shared out equally
            need = [max(tw(f'{j + 1} · {who}', ss, 750), tw(sees, ss, 500)) + 30 for j, (who, sees) in enumerate(readers)]
            spare = (width - gapn * (k - 1) - sum(need)) / k
            widths = [n_ + spare for n_ in need] if spare >= 0 else [(width - gapn * (k - 1)) / k] * k
            assert spare >= 0, f'translation lane {name}: the readers’ boxes do not fit ({-spare * k:.0f} too wide)'
            ny = y + ls + 18
            nh = ss * 3.1
            nx = f.m
            for j, (who, sees) in enumerate(readers):
                nw = widths[j]
                if j:
                    nx += widths[j - 1] + gapn
                f.add(rrect(nx, ny, nw, nh, 8, 'soft'))
                f.add(T(nx + 14, ny + ss * 1.35, f'{j + 1} · {who}', ss, 750))
                f.add(T(nx + 14, ny + ss * 2.55, sees, ss, 500, cls='mu'))
                if j < k - 1:
                    f.add(chev(nx + nw + gapn / 2, ny + nh / 2, 6))
            by = ny + nh + 20
            dec_bar(f, f.m, by, width, 20, name, scale)
            yy = dec_labels(f, f.m, by + 20 + ss * 1.4, width, ss, name)
            f.add(para(f.m, yy + ss * 1.45, extra, ss, width, ss * 1.25, cls='mu')[0])
    elif layout in ('wide', 'page'):
        ls, ss = 21, 18
        label_w = 196
        lane_h = (f.bottom - f.top) / 3
        rx = f.m + label_w + 14
        n_area = 540
        res_x = rx + n_area + 40
        res_w = f.w - f.m - res_x
        scale = res_w / peak
        for i, (name, head, units, model, readers, extra) in enumerate(lanes()):
            y = f.top + i * lane_h
            if i:
                f.add(f'<line x1="{f.m:.1f}" y1="{y - 8:.1f}" x2="{f.w - f.m:.1f}" y2="{y - 8:.1f}" class="kl" stroke-width="1"/>')
            h_svg, _, h_last = para(f.m, y + ls + 4, head, ls, label_w, ls * 1.15, 750)
            f.add(h_svg)
            f.add(para(f.m, h_last + ss * 1.45, units, ss, label_w, ss * 1.25, cls='mu')[0])
            k = len(readers)
            gapn = 22
            nw = (n_area - gapn * (k - 1)) / k
            ny = y + 2
            # every box as tall as the tallest content of all lanes, so the three lanes line up
            def node_h(who, sees):
                n1 = len(wrap(who, ss, nw - 16, 750))
                n2 = len(wrap(sees, ss * 0.92, nw - 16, 500))
                return ss * 1.3 + (n1 - 1) * ss * 1.12 + ss * 1.2 + (n2 - 1) * ss * 1.08 + ss * 0.7
            nh = min(max(ss * 4.4, max(node_h(w_, s_) for lane in lanes() for w_, s_ in lane[4])), lane_h - 20)
            for j, (who, sees) in enumerate(readers):
                nx = rx + j * (nw + gapn)
                f.add(rrect(nx, ny, nw, nh, 8, 'soft'))
                s1_, n1_, l1_ = para(nx + 10, ny + ss * 1.3, who, ss, nw - 16, ss * 1.12, 750)
                f.add(s1_)
                f.add(para(nx + 10, l1_ + ss * 1.2, sees, ss * 0.92, nw - 16, ss * 1.08, cls='mu')[0])
                if j < k - 1:
                    f.add(chev(nx + nw + gapn / 2, ny + nh / 2, 5))
            f.add(chev(res_x - 20, ny + nh / 2, 5))
            by = ny + 6
            dec_bar(f, res_x, by, res_w, 16, name, scale)
            dec_labels(f, res_x, by + 16 + ss * 1.35, res_w, ss, name)
    else:
        y = f.top
        scale = (f.w - 2 * f.m) / peak
        for i, (name, head, units, model, readers, extra) in enumerate(lanes()):
            if i:
                f.add(f'<line x1="{f.m:.1f}" y1="{y - 12:.1f}" x2="{f.w - f.m:.1f}" y2="{y - 12:.1f}" class="kl" stroke-width="1"/>')
            f.add(T(f.m, y + 16, head, 16, 750))
            s_, n_, last = para(f.m, y + 36, units + [' · ' + model], 13, f.w - 2 * f.m, 17, cls='mu')
            f.add(s_)
            y = last + 14
            for j, (who, sees) in enumerate(readers):
                f.add(rrect(f.m, y, f.w - 2 * f.m, 40, 7, 'soft'))
                f.add(T(f.m + 10, y + 17, f'{j + 1} · {who}', 13, 750))
                f.add(T(f.m + 10, y + 33, sees, 13, 500, cls='mu'))
                y += 46
            y += 4
            dec_bar(f, f.m, y, f.w - 2 * f.m, 13, name, scale)
            yy = dec_labels(f, f.m, y + 13 + 20, f.w - 2 * f.m, 13, name)
            s_, n_, last = para(f.m, yy + 20, extra, 13, f.w - 2 * f.m, 17, cls='mu')
            f.add(s_)
            y = last + 34
        f.used = y - 20
    return f


# ----------------------------------------------------------------------------------------------------- 8 checks
def check_cards():
    v = Ctx.data.values
    script, reader, browser = L('Script', 'Скрипт'), L('Reader', 'Читатель'), L('Browser', 'Браузер')
    return [
        (script, L('The build', 'Сборка'), [N('quotes-marcus')],
         L(['quotes of Marcus, each one exact span of its passage; ', N('revisions'), ' passage revisions hashed'],
           ['цитата Марка, каждая — точный отрезок своего фрагмента; ', N('revisions'), ' редакции фрагментов под хешем'])),
        (script, L('Acceptance gates', 'Приёмочные проверки'), [N('qa-blocking')],
         L(['blocking findings over all ', N('articles'), ' articles; ', N('qa-warnings'), ' warnings for a person to read'],
           ['блокирующих замечаний по всем ', N('articles'), ' статьям; ', N('qa-warnings'), ' предупреждения для человека'])),
        (reader, L('Independent review', 'Независимый рецензент'), [FACT('18'), L(' of ', ' из '), FACT('19')],
         L(['reviews through the API sent the article back; the one that accepted was Article 18’s second'],
           ['рецензий через API вернули статью автору; принявшая — вторая рецензия статьи 18'])),
        (reader, L('Reading across', 'Чтение всех статей'), [FACT('79')],
         L(['findings: ', FACT('68'), ' overlaps, ', FACT('7'), ' contradictions, ', FACT('4'), ' labels'],
           ['замечаний: ', FACT('68'), ' пересечений, ', FACT('7'), ' противоречий, ', FACT('4'), ' ярлыка'])),
        (script, L('Tests', 'Тесты'), ['npm test'],
         L(['every quote resolves, counts agree, both languages complete'], ['каждая цитата находится, числа сходятся, оба языка полны'])),
        (browser, L('Browser check', 'Проверка в браузере'), [FACT('360'), ' · ', FACT('390'), ' · ', FACT('1440')],
         L(['px wide, EN and RU, with and without Seneca; no text under 12 px'], ['px, EN и RU, с Сенекой и без; текст не мельче 12 px'])),
    ]


RULE_RU = {'what follows': 'что следует', 'first person': 'первое лицо', 'decisions': 'решения', 'shared components': 'общие части',
           'unfused': 'не слито'}


def vis_grid(f, x, y, w, h, n, groups):
    """n small squares filling the box; groups: [(count, cls, opacity)] in order."""
    pitch = math.sqrt(w * h / n)
    cols = max(1, int(w // pitch))
    while math.ceil(n / cols) * (w / cols) > h:
        cols += 1
    pitch = w / cols
    cell = pitch * 0.74
    out, k = [], 0
    stroke = {'mu': 'km', 'ink': 'k', 'ac': 'sac'}
    for count, cls, op in groups:
        pts = []
        for _ in range(count):
            r, c = divmod(k, cols)
            pts.append((x + c * pitch + cell / 2, y + r * pitch + cell / 2))
            k += 1
        out.append(dots(pts, cell, stroke.get(cls, 's' + cls), 'square', op if op < 1 else None))
    f.add(''.join(out))


def vis_rules(f, x, y, w, h, size):
    rules = Ctx.data.extra['gates']['warnings_by_rule']
    peak = max(rules.values())
    rows = list(rules.items())
    rh = min(size * 1.55, h / len(rows))
    if rh < size * 1.3:   # rows would touch: leave the bars out; the card's text carries the total
        return
    label_w = max(tw(L(r, RULE_RU.get(r, r)), size, 500) for r, _ in rows) + 10
    num_w = tw('00', size, 700) + 8
    bw = w - label_w - num_w
    if bw < 40:       # too narrow for bars (the landscape share image): the card's text carries the counts
        return
    for i, (rule, n) in enumerate(rows):
        yy = y + i * rh + rh * 0.7
        f.add(T(x, yy, L(rule, RULE_RU.get(rule, rule)), size, 500, cls='mu'))
        f.add(rrect(x + label_w, yy - size * 0.62, max(bw * n / peak, 2), size * 0.6, 2, 'ink'))
        f.add(T(x + label_w + bw * n / peak + 6, yy, [N(f'qa-rule:{rule}')], size, 700))


def vis_devices(f, x, y, w, h, size):
    sizes = [(360, 740), (390, 844), (1440, 900)]
    gap = w * 0.05
    s_ = (w - 2 * gap) / sum(a for a, _ in sizes)
    s_ = min(s_, (h - size * 1.6) / max(b for _, b in sizes))
    xx = x
    centres = []
    for (dw, dh) in sizes:
        rw, rh = dw * s_, dh * s_
        f.add(rrect(xx, y + (h - size * 1.6) - rh, rw, rh, 4, 'nf k', ' stroke-width="1.6"'))
        centres.append(xx + rw / 2)
        xx += rw + gap
    # the two phones share one label: they are too narrow for one each
    f.add(T((centres[0] + centres[1]) / 2, y + h - size * 0.2, [FACT('360'), ' · ', FACT('390')], size, 650, anchor='middle', cls='mu'))
    f.add(T(centres[2], y + h - size * 0.2, [FACT('1440')], size, 650, anchor='middle', cls='mu'))


def vis_ticks(f, x, y, w, items, size):
    yy = y
    for it in items:
        f.add(f'<path d="M{x:.1f} {yy - size * 0.35:.1f} l{size * 0.3:.1f} {size * 0.3:.1f} l{size * 0.55:.1f} {-size * 0.62:.1f}" class="nf k" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
        s_, n_, last = para(x + size * 1.3, yy, it, size, w - size * 1.3, size * 1.25)
        f.add(s_)
        yy = last + size * 1.45
    return yy


def fig_checks(layout):
    d, v = Ctx.data, Ctx.data.values
    title = L('Six layers of checks', 'Шесть слоёв проверки')
    sub = L(['Four before an article enters the record (two scripts, two readers who did not write it), then two on the page: tests and a browser.'],
            ['Четыре — прежде чем статья войдёт в данные (два скрипта и два читателя, которые её не писали), затем ещё два на странице: тесты и браузер.'])
    cards = check_cards()
    desc = L('Six layers in order: ' + '; '.join(plain(c[1]) + ': ' + plain(c[2]) + ' ' + plain(c[3]) for c in cards) + '.',
             'Шесть слоёв по порядку: ' + '; '.join(plain(c[1]) + ': ' + plain(c[2]) + ' ' + plain(c[3]) for c in cards) + '.')
    f = Fig('checks', 8, layout, title, sub, desc)
    ticks = L([['every quote resolves'], ['revisions match'], ['counts agree'], ['both languages complete']],
              [['каждая цитата находится'], ['редакции совпадают'], ['числа сходятся'], ['оба языка полны']])

    def card(x, y, w, h, i, kind, name, big, body, ts, bs, ns, visual=True):
        f.add(rrect(x, y, w, h, 10, 'soft'))
        pad = ts * 0.7
        f.add(T(x + pad, y + ts * 1.4, f'{i + 1} · {kind}', bs, 650, cls='mu'))
        s_, n_, last = para(x + pad, y + ts * 2.8, name, ts, w - 2 * pad, ts * 1.15, 750)
        f.add(s_)
        size = ns
        while size > ts and tw(big, size, 750) > w - 2 * pad:
            size -= 1
        by = last + size * 1.2
        f.add(T(x + pad, by, big, size, 750))
        if i == 4:
            end = vis_ticks(f, x + pad, by + bs * 1.6, w - 2 * pad, ticks, bs)
            return
        s_, n_, last = para(x + pad, by + bs * 1.5, body, bs, w - 2 * pad, bs * 1.25, cls='mu')
        f.add(s_)
        if not visual:
            return
        vy = last + bs * 1.3
        vh = y + h - pad - vy
        vw = w - 2 * pad
        if vh < bs * 2.5:
            return
        if i == 0:
            vis_grid(f, x + pad, vy, vw, vh, v['quotes-marcus'], [(v['quotes-marcus'], 'mu', 0.45)])
        elif i == 1:
            vis_rules(f, x + pad, vy, vw, vh, bs if bs < 16 else bs * 0.95)
        elif i == 2:
            vis_grid(f, x + pad, vy, vw, min(vh, vw * 0.35), 19, [(18, 'ac', 1), (1, 'ink', 1)])
        elif i == 3:
            vis_grid(f, x + pad, vy, vw, vh, 79, [(68, 'mu', 0.45), (7, 'ac', 1), (4, 'ink', 1)])
        elif i == 5:
            vis_devices(f, x + pad, vy, vw, vh, bs)

    if layout in ('wide', 'page'):
        n = len(cards)
        gap = 14
        w = (f.w - 2 * f.m - gap * (n - 1)) / n
        y = f.top + 4
        h = f.bottom - y
        for i, (kind, name, big, body) in enumerate(cards):
            card(f.m + i * (w + gap), y, w, h, i, kind, name, big, body, 20, 17, 38, visual=True)
            if i < n - 1:
                f.add(chev(f.m + i * (w + gap) + w + gap / 2, y + h / 2, 5))
    elif layout == 'square':
        cols, rows = 3, 2
        gx, gy = 26, 26
        w = (f.w - 2 * f.m - gx * (cols - 1)) / cols
        h = (f.bottom - f.top - gy * (rows - 1)) / rows
        for i, (kind, name, big, body) in enumerate(cards):
            r_, c_ = divmod(i, cols)
            card(f.m + c_ * (w + gx), f.top + r_ * (h + gy), w, h, i, kind, name, big, body, 27, 22, 60)
            if c_ < cols - 1:
                f.add(chev(f.m + c_ * (w + gx) + w + gx / 2, f.top + r_ * (h + gy) + h / 2, 7))
    else:
        y = f.top
        w = f.w - 2 * f.m
        for i, (kind, name, big, body) in enumerate(cards):
            h = 230 if i in (0, 1, 3, 5) else 170
            card(f.m, y, w, h, i, kind, name, big, body, 15, 13, 30)
            y += h + 12
            if i < len(cards) - 1:
                f.add(chev_down(f.w / 2, y - 6, 4))
        f.used = y
    return f


# ----------------------------------------------------------------------------------------------------- output
FIGS = {'pipeline': fig_pipeline, 'embedding': fig_embedding, 'dendrogram': fig_dendrogram, 'fusion': fig_fusion,
        'sides': fig_sides, 'seneca': fig_seneca, 'translation': fig_translation, 'checks': fig_checks}
# Which drawing stands on a wide screen: the landscape one, or the square one where the drawing needs the height.
WIDE_ON_PAGE = {'embedding': 'square', 'dendrogram': 'square', 'fusion': 'square', 'sides': 'page', 'seneca': 'page', 'translation': 'square',
                'checks': 'square'}


def draw_all(langs=('en', 'ru')):
    out = {}
    for lang in langs:
        Ctx.lang = lang
        for fid in ORDER:
            if fid not in FIGS:
                continue
            for layout in ('wide', 'square', 'phone') + (('page',) if WIDE_ON_PAGE.get(fid) == 'page' else ()):
                out[(fid, lang, layout)] = FIGS[fid](layout)
    return out


def figure_block(figs, fid, lang):
    """The page's markup between one figure's markers: the wide drawing, the phone drawing, the download links."""
    prefix = 'ru-' if lang == 'ru' else ''
    wide = figs[(fid, lang, WIDE_ON_PAGE.get(fid, 'wide'))]
    phone = figs[(fid, lang, 'phone')]
    files = lambda kind, ext: f'stoic-method/share/{fid}-{lang}-{kind}.{ext}'
    words = ({'dl': 'Download', 'sq': 'PNG square', 'ls': 'PNG landscape', 'svs': 'SVG square', 'svl': 'SVG landscape', 'all': 'All figures'}
             if lang == 'en' else
             {'dl': 'Скачать', 'sq': 'PNG квадрат', 'ls': 'PNG альбомный', 'svs': 'SVG квадрат', 'svl': 'SVG альбомный', 'all': 'Все рисунки'})
    themes = {'light': 'Light', 'dark': 'Dark'} if lang == 'en' else {'light': 'Светлые', 'dark': 'Тёмные'}
    links = (f'<span>{words["dl"]}</span>'
             + ''.join(f'<b>{themes[theme]}</b><span class="dg-g">'
                       f'<a href="{files("square" + tail, "png")}" download>{words["sq"]}</a>'
                       f'<a href="{files("landscape" + tail, "png")}" download>{words["ls"]}</a>'
                       f'<a href="{files("square" + tail, "svg")}" download>{words["svs"]}</a>'
                       f'<a href="{files("landscape" + tail, "svg")}" download>{words["svl"]}</a></span>'
                       for theme, tail in (('light', ''), ('dark', '-dark')))
             + f'<a href="stoic-method/diagrams.html{"?lang=ru" if lang == "ru" else ""}">{words["all"]}</a>')
    return (f'<div class="dg" id="{prefix}dg-{fid}">\n<style>{BLOCK_CSS}</style>\n'
            + figure_file(figs, fid, lang, 'page') + '\n'
            + figure_file(figs, fid, lang, 'phone') + '\n'
            + f'<p class="dg-dl">{links}</p>\n</div>')


def figure_file(figs, fid, lang, which):
    """figures/<id>.<lang>.svg (the drawing for a wide screen) or <id>.<lang>.phone.svg, exactly as the page inlines it."""
    prefix = 'ru-' if lang == 'ru' else ''
    if which == 'page':
        return figs[(fid, lang, WIDE_ON_PAGE.get(fid, 'wide'))].svg(f'{prefix}dg-{fid}-w', 'dg-wide')
    return figs[(fid, lang, 'phone')].svg(f'{prefix}dg-{fid}-p', 'dg-tall')


def write_page(figs):
    text = PAGE.read_text()
    ru_start = text.index('<div class="ru" lang="ru">')
    for fid in ORDER:
        if fid not in FIGS:
            continue
        pattern = re.compile(rf'(<!-- figure:{fid} -->\n?)([\s\S]*?)(\n?<!-- /figure:{fid} -->)')
        found = list(pattern.finditer(text))
        assert len(found) == 2, f'{fid}: expected one marker pair in each language, found {len(found)}'
        for m in reversed(found):
            lang = 'ru' if m.start() > ru_start else 'en'
            text = text[:m.start()] + m.group(1).rstrip('\n') + '\n' + figure_block(figs, fid, lang) + '\n' + m.group(3).lstrip('\n') + text[m.end():]
            ru_start = text.index('<div class="ru" lang="ru">')
    # an earlier version kept the figures' styles in <head>; they now travel inside the markers
    text = re.sub(r'<!-- dg:style -->[\s\S]*?<!-- /dg:style -->\n?', '', text)
    current = PAGE.read_text()
    PAGE.write_text(text)
    return current != text


FIGURES = OUT / 'figures'
SOURCES = {
    'pipeline': ['public/apps/stoic-constitution.json', 'public/apps/stoic-constitution/c*.json', 'public/apps/stoic-method/diagram-data.json',
                 'content/aurelius/translation/project-v1.json', 'content/aurelius/translation/seneca-v1.json', 'content/aurelius/translation/ru-v1.json'],
    'embedding': ['public/apps/stoic-method/diagram-data.json (projection)', 'content/aurelius/topics.json', 'public/apps/stoic-constitution.json'],
    'dendrogram': ['public/apps/stoic-method/diagram-data.json (tree)', 'content/aurelius/topics.json', 'public/apps/stoic-constitution.json'],
    'fusion': ['public/apps/stoic-constitution/c6.json (Article 1)', 'public/apps/stoic-constitution/ru/c6.json'],
    'sides': ['public/apps/stoic-constitution.json', 'public/apps/stoic-constitution/c*.json (groups)'],
    'seneca': ['public/apps/stoic-constitution.json (authors, effects)', 'public/apps/stoic-constitution/c*.json (voices.seneca)'],
    'translation': ['content/aurelius/translation/project-v1.json', 'content/aurelius/translation/seneca-v1.json',
                    'content/aurelius/translation/ru-v1.json'],
    'checks': ['public/apps/stoic-constitution/c*.json', 'public/apps/stoic-method/diagram-data.json (gates: scripts/aurelius-qa.py --json articles)',
               'the paper’s Table 10 (review record, from plan/stoicism/36-finish-log.md)', 'scripts/aurelius-constitution-check.py (widths)'],
}


def captions():
    """Paper captions from the published numbers: {id: {'en': ..., 'ru': ...}} (without the 'Figure N.' prefix)."""
    v = Ctx.data.values
    t = f"{Ctx.data.floats()['trust']:.2f}"
    e = lambda n: fmt(n, 'en')
    r = lambda n: fmt(n, 'ru')
    art = Ctx.data.articles[0]
    return {
        'pipeline': {
            'en': f"The pipeline, with the published count at each stage. The {v['passages']} passages of the 1634 English are embedded as {e(v['dims'])}-dimensional vectors, joined into one Ward tree and cut into {v['chapters']} chapters and {v['sections']} sections; each section is fused into one article ({v['claims']} fused claims, {v['single']} points said once); Seneca adds {v['seneca-items']} typed items with {v['seneca-pieces']} distinct quotes from {v['letters']} letters; {v['tr-marcus']} passages from the Greek and {v['tr-seneca']} from the Latin are translated into English, and all {v['tr-ru']} into Russian.",
            'ru': f"Конвейер и опубликованные числа на каждом этапе. {v['passages']} фрагментов английского текста 1634 года превращены в векторы из {r(v['dims'])} чисел, объединены в одно дерево Уорда и разрезаны на {v['chapters']} глав и {v['sections']} разделов; каждый раздел слит в одну статью ({v['claims']} утверждений, {v['single']} — сказано однажды); Сенека добавляет {v['seneca-items']} {ru_plural(v['seneca-items'], 'вклад', 'вклада', 'вкладов')} с {v['seneca-pieces']} разными цитатами из {v['letters']} писем; {v['tr-marcus']} фрагментов с греческого и {v['tr-seneca']} с латыни переведены на английский, а все {v['tr-ru']} — на русский."},
        'embedding': {
            'en': f"The {v['passages']} passages placed by their vectors: a t-SNE projection of the {e(v['dims'])}-dimensional embeddings (cosine distance, perplexity 50; trustworthiness {t} over 10 neighbours), drawn once per chapter. Coloured points are the chapter’s passages, grey points the rest of the book; numbers mark the centre of each section’s passages, by article. The projection keeps near neighbours but not large distances; chapters and sections were found on the full vectors, not on this picture.",
            'ru': f"{v['passages']} фрагментов, расставленных по их векторам: проекция t-SNE векторов из {r(v['dims'])} чисел (косинусное расстояние, перплексия 50; достоверность {t.replace('.', ',')} по 10 соседям), по одной панели на главу. Цветные точки — фрагменты главы, серые — остальная книга; числа стоят в центре фрагментов каждого раздела и обозначают статьи. Проекция сохраняет ближайших соседей, но не большие расстояния; главы и разделы найдены по полным векторам, а не по этому рисунку."},
        'dendrogram': {
            'en': f"Ward clustering of the {v['passages']} passage vectors into {v['chapters']} chapters and {v['sections']} sections. Leaves lie on the rim and the root at the centre; the radius encodes the Ward merge distance. The grey circle is the cut of the whole tree into chapters; each chapter was clustered again, and a dark arc marks its cut into max(2, round(n ÷ 11)) sections. The outer ring shows the sections with their article numbers; chapters are numbered in page order, which is an editorial choice.",
            'ru': f"Кластеризация Уорда {v['passages']} векторов фрагментов на {v['chapters']} глав и {v['sections']} разделов. Листья — по краю, корень — в центре; радиус передаёт расстояние слияния по Уорду. Серый круг — разрез всего дерева на главы; каждая глава кластеризована заново, и тёмная дуга отмечает её разрез на max(2, round(n ÷ 11)) разделов. Внешнее кольцо — разделы с номерами статей; главы пронумерованы в порядке страницы, это выбор редактора."},
        'fusion': {
            'en': f"Fusion of one section into Article 1, “{art['title']}”. Curves lead from each passage to the claims it feeds, and a line of its colour runs under the exact words it backs. Colours repeat ({len(set(Ctx.data.articles[0]['colors'].values()))} for the {len(Ctx.data.articles[0]['colors'])} quoted passages), but two passages that back the same claim never share one; the passage numbers tell them apart. The {v['a1-claims']} fused claims each rest on two or more passages; the {v['a1-single']} points made by one passage only are kept apart as “said once”; “because” in claim 5 is the editor’s inference (purple). The statement gathers claims 1 and 2. Passage 8.52 is set aside, with its reason recorded.",
            'ru': f"Слияние одного раздела в статью 1 «{Ctx.data.rec['ru'][1][0]['title']}». Линии ведут от каждого фрагмента к утверждениям, которые он питает, а черта его цвета проходит под точными словами, которые он подкрепляет. Цвета повторяются ({len(set(Ctx.data.articles[0]['colors'].values()))} на {len(Ctx.data.articles[0]['colors'])} цитируемых фрагментов), но у двух фрагментов одного утверждения цвета всегда разные; различают их номера. Каждое из {v['a1-claims']} утверждений опирается на два фрагмента или больше; {v['a1-single']} пункта, высказанные одним фрагментом, вынесены отдельно как «сказано однажды»; «потому что» в утверждении 5 — вывод редактора (фиолетовым). Положение собирает утверждения 1 и 2. Фрагмент 8.52 отложен, причина записана."},
        'sides': {
            'en': f"The five sides of all {v['articles']} articles. A dot is a side with at least one claim or said-once item, its area proportional to their number; a ring is a side left empty, which the article explains in one sentence. Why is filled in {v['fill-why']} articles, In action in {v['fill-action']}, Practice in {v['fill-practice']}, When it breaks in {v['fill-breaks']} and If I doubt it in {v['fill-doubt']}.",
            'ru': f"Пять сторон всех {v['articles']} статей. Точка — сторона, где есть хотя бы одно утверждение или пункт «сказано однажды», площадь точки пропорциональна их числу; кольцо — сторона, оставленная пустой, что статья объясняет одним предложением. «Почему» заполнено в {v['fill-why']} статьях, «На деле» — в {v['fill-action']}, «Упражнение» — в {v['fill-practice']}, «Когда не выходит» — в {v['fill-breaks']}, «Если я сомневаюсь» — в {v['fill-doubt']}."},
        'seneca': {
            'en': f"Seneca as a second voice. Left: how his passages were found, from a search corpus of {e(v['seneca-corpus'])} passages of all {v['seneca-letters-all']} letters ranked by vector similarity and by logged word searches, then read in context, and how they were placed. Right: the {v['seneca-items']} items per article, stacked as Backs ({v['seneca-backs']}), Adds ({v['seneca-adds']}) and Limits ({v['seneca-limits']}). {v['clauses']} clauses are appended to Marcus’s sentences without rewriting them ({v['clauses-adds']} add, {v['clauses-limits']} limit, {v['clauses-challenges']} challenge).",
            'ru': f"Сенека как второй голос. Слева — как найдены его фрагменты (корпус для поиска из {r(v['seneca-corpus'])} фрагментов всех {v['seneca-letters-all']} писем, ранжированный по сходству векторов и по записанным поискам слов, затем чтение в контексте) и как они размещены. Справа — {v['seneca-items']} {ru_plural(v['seneca-items'], 'вклад', 'вклада', 'вкладов')} по статьям: «Подкрепляет» ({v['seneca-backs']}), «Добавляет» ({v['seneca-adds']}) и «Ограничивает» ({v['seneca-limits']}). {v['clauses']} {ru_plural(v['clauses'], 'приписка дописана', 'приписки дописаны', 'приписок дописаны')} к предложениям Марка, не переписывая их ({v['clauses-adds']} добавляют, {v['clauses-limits']} ограничивают, {v['clauses-challenges']} возражают)."},
        'translation': {
            'en': f"Three readings per passage. Greek into English ({v['tr-marcus']} passages of Marcus) and Latin into English ({v['tr-seneca']} sections of Seneca from {v['tr-letters']} letters): a translator, a checker and a settler, each Claude Fable 5.2 in a fresh context. English into Russian ({v['tr-ru']} passages): Claude Opus 5.5 translated, Claude Sonnet 5.5 checked, the translator settled. The bars, on one scale, show how the checker’s points were settled: Greek {e(v['dec-marcus-accepted'])} accepted, {v['dec-marcus-partly']} partly, {v['dec-marcus-declined']} declined and {v['dec-marcus-free']} in free form (the pilot); Latin {v['dec-seneca-accepted']}, {v['dec-seneca-partly']} and {v['dec-seneca-declined']}; Russian {v['dec-ru-accepted']}, {v['dec-ru-partly']} and {v['dec-ru-declined']}.",
            'ru': f"Три прочтения на фрагмент. С греческого на английский ({v['tr-marcus']} {ru_plural(v['tr-marcus'], 'фрагмент', 'фрагмента', 'фрагментов')} Марка) и с латыни на английский ({v['tr-seneca']} {ru_plural(v['tr-seneca'], 'раздел', 'раздела', 'разделов')} Сенеки из {v['tr-letters']} писем): переводчик, проверяющий и решающий, каждый — Claude Fable 5.2 в новом контексте. С английского на русский ({v['tr-ru']} фрагмента): переводил Claude Opus 5.5, проверял Claude Sonnet 5.5, решал переводчик. Полосы в одном масштабе показывают, как решены замечания проверяющего: греческий — {v['dec-marcus-accepted']} принято, {v['dec-marcus-partly']} частично, {v['dec-marcus-declined']} отклонено и {v['dec-marcus-free']} в свободной форме (пилот); латынь — {v['dec-seneca-accepted']}, {v['dec-seneca-partly']} и {v['dec-seneca-declined']}; русский — {v['dec-ru-accepted']}, {v['dec-ru-partly']} и {v['dec-ru-declined']}."},
        'checks': {
            'en': f"Six layers of checks: four before an article enters the record, two on the published page. Two scripts: the build, which requires each of the {v['quotes-marcus']} quotes of Marcus to be one exact span of its passage and checks {e(v['revisions'])} passage revisions against their hashes, and the acceptance gates ({v['qa-blocking']} blocking findings and {v['qa-warnings']} warnings over {v['articles']} articles). Two readers who did not write the article: an independent reviewer (18 of the 19 reviews made through the API sent the article back; the one that accepted was Article 18’s second review) and a reading across all articles (79 findings: 68 overlaps, 7 contradictions, 4 labels). Then the tests and a browser check at 360, 390 and 1440 px.",
            'ru': f"Шесть слоёв проверки: четыре — прежде чем статья войдёт в данные, два — на опубликованной странице. Два скрипта: сборка, которая требует, чтобы каждая из {v['quotes-marcus']} {ru_plural(v['quotes-marcus'], 'цитаты', 'цитат', 'цитат')} Марка была точным отрезком своего фрагмента, и сверяет {r(v['revisions'])} {ru_plural(v['revisions'], 'редакцию', 'редакции', 'редакций')} фрагментов с их хешами, и приёмочные проверки ({v['qa-blocking']} блокирующих замечаний и {v['qa-warnings']} {ru_plural(v['qa-warnings'], 'предупреждение', 'предупреждения', 'предупреждений')} по {v['articles']} статьям). Два читателя, которые не писали статью: независимый рецензент (18 из 19 рецензий, сделанных через API, вернули статью автору; принявшая — вторая рецензия статьи 18) и чтение всех статей подряд (79 замечаний: 68 пересечений, 7 противоречий, 4 ярлыка). Затем тесты и проверка в браузере при ширине 360, 390 и 1440 px."},
    }


def write_figures(figs):
    """figures/<id>.<lang>.svg and .phone.svg, and figures/figures.json, the manifest the paper reads."""
    FIGURES.mkdir(parents=True, exist_ok=True)
    caps = captions()
    entries = []
    for n, fid in enumerate(ORDER, 1):
        if fid not in FIGS:
            continue
        files = {}
        for lang in ('en', 'ru'):
            for which, suffix in (('page', ''), ('phone', '.phone')):
                path = FIGURES / f'{fid}.{lang}{suffix}.svg'
                path.write_text(figure_file(figs, fid, lang, which) + '\n')
            files[lang] = {'page': f'figures/{fid}.{lang}.svg', 'phone': f'figures/{fid}.{lang}.phone.svg',
                           'square_png': f'share/{fid}-{lang}-square.png', 'landscape_png': f'share/{fid}-{lang}-landscape.png',
                           'square_svg': f'share/{fid}-{lang}-square.svg', 'landscape_svg': f'share/{fid}-{lang}-landscape.svg',
                           'dark': {'square_png': f'share/{fid}-{lang}-square-dark.png', 'landscape_png': f'share/{fid}-{lang}-landscape-dark.png',
                                    'square_svg': f'share/{fid}-{lang}-square-dark.svg', 'landscape_svg': f'share/{fid}-{lang}-landscape-dark.svg'}}
        title = {lang: plain_in(figs[(fid, lang, 'wide')].title, lang) for lang in ('en', 'ru')}
        entries.append({'id': fid, 'number': n, 'title': title,
                        'caption': {'en': f'Figure {n}. ' + caps[fid]['en'], 'ru': f'Рис. {n}. ' + caps[fid]['ru']},
                        'drawing_on_wide_screens': WIDE_ON_PAGE.get(fid, 'wide'), 'sources': SOURCES[fid], 'files': files})
    manifest = {
        'about': 'The figures of the method paper (public/apps/stoic-method.html), drawn from the published record. The page inlines '
                 'files.<lang>.page (wide screens, print) and .phone (under 700 px) between <!-- figure:<id> --> markers.',
        'made_by': 'scripts/stoic-method-figures.py',
        'palette': {
            'note': 'Validated with the dataviz palette validator: chapters on adjacent pairs (light on #ffffff and #f5f7fa, dark on #191e26 '
                    'and #101318); effects on all pairs; decisions as an ordinal ramp. Seven chapter colours fail the all-pairs floors, '
                    'so the map is drawn as small multiples.',
            'light': {k: LIGHT[k] for k in ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'fb', 'fa', 'fl', 'd3', 'd2', 'd1']},
            'dark': {k: DARK[k] for k in ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'fb', 'fa', 'fl', 'd3', 'd2', 'd1']},
            'groups': {'chapters': ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'], 'effects': ['fb', 'fa', 'fl'], 'decisions_ordinal': ['d3', 'd2', 'd1']},
            'surfaces': {'light': ['#ffffff', '#f5f7fa'], 'dark': ['#191e26', '#101318']},
        },
        'figures': entries,
    }
    (FIGURES / 'figures.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    return entries


def plain_in(parts, lang):
    was, Ctx.lang = Ctx.lang, lang
    try:
        return plain(parts)
    finally:
        Ctx.lang = was


def write_share(figs):
    SHARE.mkdir(parents=True, exist_ok=True)
    made = []
    for (fid, lang, layout), f in figs.items():
        if layout not in ('wide', 'square'):
            continue
        kind = 'landscape' if layout == 'wide' else 'square'
        for mode, tail in (('share', ''), ('share-dark', '-dark')):
            path = SHARE / f'{fid}-{lang}-{kind}{tail}.svg'
            path.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + f.svg(f'{fid}-{lang}-{kind}{tail}', 'share', mode=mode) + '\n')
            made.append(path)
    return made


def render_png(svgs, page, scale=1):
    out = []
    for path in svgs:
        svg = path.read_text().split('\n', 1)[1]
        w, h = (int(x) for x in re.search(r'width="(\d+)" height="(\d+)"', svg).groups())
        page.set_viewport_size({'width': w, 'height': h})
        page.set_content(f'<style>{FONT_FACE}html,body{{margin:0}}svg{{display:block}}</style>{svg}')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(20)
        png = path.with_suffix('.png')
        page.screenshot(path=str(png), clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        out.append(png)
    return out


def write_gallery(figs):
    cards = {'en': [], 'ru': []}
    for lang in ('en', 'ru'):
        Ctx.lang = lang
        prefix = 'ru-' if lang == 'ru' else ''
        for n, fid in enumerate(ORDER, 1):
            if fid not in FIGS:
                continue
            f = figs[(fid, lang, 'wide')]
            name = f'share/{fid}-{lang}'
            word = ({'sq': 'PNG square', 'ls': 'PNG landscape', 'svs': 'SVG square', 'svl': 'SVG landscape', 'page': 'On the page'} if lang == 'en' else
                    {'sq': 'PNG квадрат', 'ls': 'PNG альбомный', 'svs': 'SVG квадрат', 'svl': 'SVG альбомный', 'page': 'На странице'})
            label = f'Figure {n}' if lang == 'en' else f'Рис. {n}'
            themes = {'light': 'Light', 'dark': 'Dark'} if lang == 'en' else {'light': 'Светлые', 'dark': 'Тёмные'}
            page_link = f'../stoic-method.html{"?lang=ru" if lang == "ru" else ""}#{prefix}fig-{fid}'
            cards[lang].append(
                f'<li class="card" id="{prefix}g-{fid}"><a class="thumb" href="{name}-square.png"><picture><source media="(prefers-color-scheme: dark)" srcset="{name}-landscape-dark.png">'
                f'<img src="{name}-landscape.png" width="1200" height="627" loading="lazy" alt="{esc(plain(f.desc))}"></picture></a>'
                f'<p class="n">{label}</p><h2>{esc(plain(f.title))}</h2><p class="sub">{esc(plain(f.subtitle))}</p>'
                + ''.join(f'<p class="dl"><b>{themes[theme]}</b><a href="{name}-square{tail}.png" download>{word["sq"]}</a><a href="{name}-landscape{tail}.png" download>{word["ls"]}</a>'
                          f'<a href="{name}-square{tail}.svg" download>{word["svs"]}</a><a href="{name}-landscape{tail}.svg" download>{word["svl"]}</a></p>'
                          for theme, tail in (('light', ''), ('dark', '-dark')))
                + f'<p class="dl"><a href="{page_link}">{word["page"]}</a></p></li>')
    head = {'en': ('The figures', 'How the Constitution was made · Figures',
                   'The eight figures of the method paper, drawn from the published record. Each comes as a 1200 × 1200 and a 1200 × 627 image for sharing, and as SVG, in light and in dark.',
                   'Back to the method paper', '../stoic-method.html'),
            'ru': ('Рисунки', 'Как сделана конституция · Рисунки',
                   'Восемь рисунков к описанию метода, построенных по опубликованным данным. Каждый — в виде картинок 1200 × 1200 и 1200 × 627 для публикации и в SVG, в светлом и в тёмном варианте.',
                   'Назад к описанию метода', '../stoic-method.html?lang=ru')}
    blocks = []
    for lang in ('en', 'ru'):
        h1, _, intro, back, href = head[lang]
        blocks.append(f'<div class="{lang}" lang="{lang}"><header class="wrap"><p class="eyebrow">{"Stoic Constitution · Method" if lang == "en" else "Стоическая конституция · Метод"}</p>'
                      f'<h1>{h1}</h1><p class="lede">{intro}</p><p class="back"><a href="{href}">{back}</a></p></header>'
                      f'<ol class="wrap grid">{"".join(cards[lang])}</ol></div>')
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:,">
<title>{head['en'][1]}</title>
<meta name="description" content="{head['en'][2]}">
<link rel="preload" href="/fonts/manrope/manrope-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/apps/site-chrome.css">
<script>
/* Generated by scripts/stoic-method-figures.py. The language follows the reader as on the method page: ?lang, else the Stoic pages' choice, else the site's. */
(function () {{
  var asked = new URLSearchParams(location.search).get('lang'), lang = 'en', page = null, site = null;
  try {{ page = localStorage.getItem('stoic-constitution:lang'); site = localStorage.getItem('site-lang'); }} catch (e) {{ /* English */ }}
  if (asked === 'ru' || asked === 'en') lang = asked; else if (page === 'ru' || page === 'en') lang = page; else if (site === 'ru') lang = 'ru';
  document.documentElement.lang = lang; document.documentElement.setAttribute('data-lang', lang);
}})();
</script>
<style>
[data-lang=ru] .en,:root:not([data-lang=ru]) .ru{{display:none!important}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--site-sans)}}
h1,h2,p,ol{{margin:0}}
a{{color:var(--accent);text-underline-offset:3px}}
.wrap{{max-width:1180px;margin:0 auto;padding-inline:clamp(16px,4vw,40px)}}
header.wrap{{padding-block:28px 8px}}
.eyebrow{{font:650 12px/1.4 var(--site-sans);text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}}
h1{{font:400 clamp(32px,7vw,48px)/1.08 Georgia,'Times New Roman',serif;letter-spacing:-.02em;margin:8px 0 10px}}
.lede{{max-width:720px;font-size:17px}}
.back{{margin-top:10px;font-size:15px}}
.grid{{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,520px),1fr));gap:22px;padding-block:24px 48px}}
.card{{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px 14px}}
.thumb{{display:block;border-radius:6px;overflow:hidden;border:1px solid var(--line)}}
.thumb img{{display:block;width:100%;height:auto}}
.n{{font:650 12px/1.4 var(--site-sans);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:12px}}
h2{{font:400 22px/1.25 Georgia,'Times New Roman',serif;margin-top:2px}}
.sub{{color:var(--muted);font-size:14.5px;margin-top:4px}}
.dl{{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:14px}}
.dl a{{display:inline-flex;align-items:center;min-height:36px}}
.dl b{{display:inline-flex;align-items:center;min-height:36px;font-weight:650;min-width:4.5em}}
</style>
</head>
<body>
<script src="/apps/site-chrome.js"></script>
<main id="main">
{chr(10).join(blocks)}
</main>
</body>
</html>
"""
    GALLERY.write_text(page)
    return GALLERY


def preview(figs, folder: Path, page):
    """Every drawing on one sheet per figure, light and dark, for looking at."""
    folder.mkdir(parents=True, exist_ok=True)
    font = FONT_FACE
    dark_vars = var_block({**LIGHT, **DARK, 'bg': '#191e26', 'ink': '#edf1f7', 'mu': '#a5afbf', 'line': '#303947', 'accent': '#ffa080',
                           'e': '#b9adf0', 'et': '#2e2948', 'p1': '#2f63e1', 'p2': '#a95e86', 'p3': '#d63a00', 'p4': '#437f43', 'p5': '#2a97bf'})
    shots = []
    for (fid, lang, layout), f in figs.items():
        for theme in ('light', 'dark'):
            svg = f.svg(f'pv-{fid}-{lang}-{layout}', 'pv', mode='share')
            if theme == 'dark':
                svg = svg.replace(f'svg{{{var_block(LIGHT)}', f'svg{{{dark_vars}', 1)
            width = 340 if layout == 'phone' else 1200
            scale = 1 if layout == 'phone' else 710 / 1200
            page.set_viewport_size({'width': math.ceil(width * scale), 'height': 900})
            page.set_content(f'<style>{font}body{{margin:0}}svg{{display:block;width:{width * scale:.0f}px;height:auto}}</style>{svg}')
            page.wait_for_timeout(30)
            name = folder / f'{fid}-{lang}-{layout}-{theme}.png'
            page.locator('svg').screenshot(path=str(name))
            shots.append(name)
    return shots


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', type=Path, help='write a PNG of every drawing into this folder and stop')
    ap.add_argument('--only', help='comma-separated figure ids')
    ap.add_argument('--no-png', action='store_true')
    ap.add_argument('--scale', type=int, default=1, help='pixel density of the PNG (1 gives exactly 1200 × 1200 and 1200 × 627)')
    args = ap.parse_args()
    Ctx.data = Data()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        Ctx.meter = Meter(page)
        if args.only:
            for k in list(FIGS):
                if k not in args.only.split(','):
                    FIGS.pop(k)
        figs = draw_all()
        if args.preview:
            shots = preview(figs, args.preview, browser.new_page())
            print(f'{len(shots)} previews in {args.preview}')
            browser.close()
            return
        entries = write_figures(figs)
        changed = write_page(figs)
        svgs = write_share(figs)
        pngs = [] if args.no_png else render_png(svgs, browser.new_page(device_scale_factor=args.scale), args.scale)
        gallery = write_gallery(figs)
        browser.close()
    print(f'{len(entries)} figures and figures.json in {FIGURES.relative_to(ROOT)}; page {"updated" if changed else "unchanged"}; {len(svgs)} SVG and {len(pngs)} PNG in {SHARE.relative_to(ROOT)}; gallery {gallery.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
