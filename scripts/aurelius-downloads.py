#!/usr/bin/env python3
"""Write the project's translations as files people can download: public/downloads/*.{md,txt,epub}.

Run: apps/aurelius/.venv/bin/python scripts/aurelius-downloads.py [--check]

- marcus-meditations-project-v1: the whole Meditations, from content/aurelius/translation/project-v1.json
- seneca-letters-selection-v1: the sections of Seneca's Moral Letters the Stoic Constitution quotes, from
  content/aurelius/translation/seneca-v1.json

English only: the Greek and Latin stay on the site, so the files carry no licence but the owner's dedication of the English
to the public domain (CC0 1.0; owner, 23 Nov 2026). Markdown and EPUB carry the translators' notes; plain text is the
translation alone. Each file opens with what it is, how it was made and what no one has checked yet. The output is
reproducible (fixed zip dates and order), so --check can say whether the files are up to date with the records.
"""
from __future__ import annotations

import html
import io
import re
import sys
import zipfile
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/downloads'
SITE = 'https://ilyadays.vercel.app'
CC0 = ('Dedicated to the public domain (CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/). '
       'You may copy, change, publish and sell it without asking and without naming anyone. '
       'Words of the Greek or Latin quoted in the notes come from the source texts named below.')


def ref_key(ref: str) -> tuple:
    m = re.match(r'(?:Ep\. )?(\d+)\.(\d+)([a-z]?)', ref)
    return (int(m[1]), int(m[2]), m[3])


def marcus() -> dict:
    d = json.loads((ROOT / 'content/aurelius/translation/project-v1.json').read_text())
    passages = sorted(d['passages'], key=lambda p: ref_key(p['standard_ref']))
    groups = {}
    for p in passages:
        groups.setdefault(f'Book {ref_key(p["standard_ref"])[0]}', []).append(
            {'ref': p['standard_ref'], 'english': p['english'], 'notes': [(n['greek'], n['note'], n.get('other_reading', '')) for n in p['notes']]})
    return {'slug': 'marcus-meditations-project-v1', 'title': 'Marcus Aurelius, Meditations',
            'subtitle': 'A new English translation from the Greek (project-v1)', 'author': 'Marcus Aurelius',
            'made': d['made'], 'status': d['status'], 'method': d['method'], 'limits': d['limits'],
            'source': d['edition']['citation'] + ' Digitised text from the Perseus Digital Library (CC BY-SA); the Greek is not included in this file.',
            'about_refs': 'Passages are numbered by book and chapter as in modern editions. A dash joins chapters translated as one passage; a letter marks part of a chapter.',
            'groups': list(groups.items()), 'site': f'{SITE}/apps/stoic-translation.html'}


def seneca() -> dict:
    d = json.loads((ROOT / 'content/aurelius/translation/seneca-v1.json').read_text())
    groups = {}
    for p in sorted(d['passages'], key=lambda p: ref_key(p['ref'])):
        n = ref_key(p['ref'])[0]
        groups.setdefault(f'Letter {n}: {d["letters"][str(n)]}', []).append(
            {'ref': p['ref'].removeprefix('Ep. '), 'english': p['english'], 'notes': [(n_['latin'], n_['note'], n_.get('other_reading', '')) for n_ in p['notes']]})
    return {'slug': 'seneca-letters-selection-v1', 'title': 'Seneca, Moral Letters to Lucilius: a selection',
            'subtitle': 'A new English translation from the Latin of the sections the Stoic Constitution quotes (seneca-v1)', 'author': 'Seneca',
            'made': d['made'], 'status': d['status'], 'method': d['method'], 'limits': d['limits'],
            'source': d['edition']['latin'] + '. The Latin is not included in this file.',
            'about_refs': 'Sections are numbered by letter and section as in the standard editions. Only the quoted sections are translated, so a section may begin in the middle of an argument. The letter titles are the project’s own.',
            'groups': list(groups.items()), 'site': f'{SITE}/apps/stoic-constitution.html'}


RU_CC0 = ('Передаётся в общественное достояние (CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/deed.ru): '
          'можно копировать, изменять, публиковать и продавать без разрешения и без указания авторов.')


def russian(work: dict, slug: str, title: str, subtitle: str, author: str, site: str) -> dict:
    """A Russian edition of a work: the same groups, the Russian of content/aurelius/translation/ru-v1.json, no notes."""
    ru = json.loads((ROOT / 'content/aurelius/translation/ru-v1.json').read_text())
    kind = 'marcus' if work['slug'].startswith('marcus') else 'seneca'
    text = {(p['ref'].removeprefix('Ep. ')): p['russian'] for p in ru['passages'] if p['work'] == kind}
    groups = [(name if kind == 'marcus' else name, [{'ref': it['ref'], 'english': text[it['ref']], 'notes': []} for it in items]) for name, items in work['groups']]
    if kind == 'marcus': groups = [(name.replace('Book', 'Книга'), items) for name, items in groups]
    else:
        titles = json.loads((ROOT / 'content/aurelius/translation/seneca-v1.json').read_text())['letters']
        groups = [(f'Письмо {name.split()[1].rstrip(":")}', items) for name, items in groups]
    passages = sum(len(items) for _, items in groups)
    return {'slug': slug, 'title': title, 'subtitle': subtitle, 'author': author, 'made': ru['made'], 'lang': 'ru',
            'status': (f'{passages} фрагментов. Переведено на русский с английского перевода этого проекта, а не с греческого или латыни, '
                       'по решению владельца проекта. Русский текст не читал ни владелец, ни носитель языка, сверивший его с английским.'),
            'method': ['Модель Claude Opus 5.5 перевела каждый фрагмент с английского, пользуясь коротким словарём стоических терминов и не опираясь ни на один изданный русский перевод.',
                       'Второй читатель на другой модели (Claude Sonnet 5.5) сверил русский текст с английским и отметил каждое место, где русский говорит больше, меньше или иное.',
                       'Переводчик письменно решил каждое замечание; затем ключевые термины были согласованы по всей книге, а сценарии проверили полноту, порядок, абзацы и типографику.'],
            'limits': ['Это перевод перевода: где английский выбирал между прочтениями греческого или латинского текста, русский следует английскому выбору.',
                       'Примечания переводчиков к греческому и латинскому тексту есть только в английском издании.'],
            'source': f'Английский перевод проекта ({work["slug"]}); оригинал в этот файл не включён.',
            'about_refs': 'Нумерация по книге и главе (у Сенеки: по письму и параграфу), как в современных изданиях.',
            'groups': groups, 'site': site, 'licence': RU_CC0}


def front(w: dict) -> list[str]:
    if w.get('lang') == 'ru':
        return [f'Сделано {w["made"]}. {w["status"]}', 'Как сделан перевод:'] + [f'- {m}' for m in w['method']] + \
               ['Чего он не обещает:'] + [f'- {m}' for m in w['limits']] + [f'Источник: {w["source"]}', w['about_refs'], f'Лицензия: {w["licence"]}', f'В сети: {w["site"]}']
    return [f'Made {w["made"]}. {w["status"]}', 'How it was made:'] + [f'- {m}' for m in w['method']] + \
           ['What it cannot promise:'] + [f'- {m}' for m in w['limits']] + [f'Source text: {w["source"]}', w['about_refs'], f'Licence: {CC0}', f'On the web: {w["site"]}']


def markdown(w: dict) -> str:
    out = [f'# {w["title"]}', '', f'*{w["subtitle"]}*', '']
    for line in front(w):
        out += [line] if line.startswith('- ') else ['', line]
    for name, items in w['groups']:
        out += ['', f'## {name}']
        for it in items:
            out += ['', f'### {it["ref"]}', '', it['english']]
            if it['notes']:
                out += ['', '<details><summary>Notes</summary>', '']
                out += [f'- *{src}*: {note}' + (f' Other reading: {other}' if other else '') for src, note, other in it['notes']]
                out += ['', '</details>']
    return '\n'.join(out).replace('\n\n\n', '\n\n') + '\n'


def text(w: dict) -> str:
    out = [w['title'].upper(), w['subtitle'], ''] + front(w)
    for name, items in w['groups']:
        out += ['', '', name.upper(), '']
        for it in items:
            out += [f'{it["ref"]}  {it["english"]}', '']
    return '\n'.join(out).rstrip() + '\n'


def xhtml(title: str, body: str, lang: str = 'en') -> str:
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="' + lang + '" xml:lang="' + lang + '">\n'
            f'<head><meta charset="utf-8"/><title>{html.escape(title)}</title><link rel="stylesheet" href="style.css"/></head>\n<body>\n{body}\n</body>\n</html>\n')


def epub(w: dict) -> bytes:
    e = html.escape
    files = {'style.css': ('body{font-family:serif;line-height:1.5;margin:0 4%}h1,h2{font-weight:normal}h3{font-size:1em;margin:1.4em 0 .2em}'
                           '.ref{color:#666}.notes{font-size:.85em;color:#444}.notes li{margin:.2em 0}p.front{font-size:.9em}a.n{font-size:.8em}')}
    fr = []
    for line in front(w):
        fr.append(f'<li>{e(line[2:])}</li>' if line.startswith('- ') else f'<p class="front">{e(line)}</p>')
    L = w.get('lang', 'en')
    files['front.xhtml'] = xhtml(w['title'], f'<h1>{e(w["title"])}</h1><p><em>{e(w["subtitle"])}</em></p>\n' + re.sub(r'(<li>.*?</li>\n?)+', lambda m: f'<ul>{m[0]}</ul>', '\n'.join(fr), flags=re.S), L)
    chapters = []
    for i, (name, items) in enumerate(w['groups'], 1):
        body, notes = [f'<h2>{e(name)}</h2>'], []
        for it in items:
            anchor = 'p' + re.sub(r'[^0-9a-z]', '-', it['ref'])
            link = f' <a class="n" href="#n-{anchor}" id="{anchor}">{"примечания" if L == "ru" else "notes"}</a>' if it['notes'] else f'<span id="{anchor}"></span>'
            body.append(f'<h3><span class="ref">{e(it["ref"])}</span>{link}</h3>\n<p>{e(it["english"])}</p>')
            if it['notes']:
                notes.append(f'<li id="n-{anchor}"><a href="#{anchor}">{e(it["ref"])}</a><ul>' + ''.join(
                    f'<li><em>{e(s)}</em>: {e(n)}' + (f' Other reading: {e(o)}' if o else '') + '</li>' for s, n, o in it['notes']) + '</ul></li>')
        if notes:
            body.append(f'<section class="notes"><h3>Notes</h3><ol>{"".join(notes)}</ol></section>')
        files[f'c{i:03d}.xhtml'] = xhtml(name, '\n'.join(body), L); chapters.append((f'c{i:03d}.xhtml', name))
    about, contents = ('О переводе', 'Содержание') if L == 'ru' else ('About this translation', 'Contents')
    nav = ''.join(f'<li><a href="{f}">{e(n)}</a></li>' for f, n in [('front.xhtml', about)] + chapters)
    files['nav.xhtml'] = xhtml(contents, f'<nav epub:type="toc" id="toc"><h1>{contents}</h1><ol>{nav}</ol></nav>', L)
    order = ['front.xhtml'] + [f for f, _ in chapters]
    manifest = ''.join(f'<item id="i{k}" href="{f}" media-type="application/xhtml+xml"/>' for k, f in enumerate(order)) + \
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>'
    opf = ('<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="' + L + '">'
           '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
           f'<dc:identifier id="uid">{SITE}/downloads/{w["slug"]}</dc:identifier><dc:title>{e(w["title"])}</dc:title>'
           f'<dc:creator>{e(w["author"])}</dc:creator><dc:language>{L}</dc:language><dc:rights>CC0 1.0 Universal</dc:rights>'
           f'<meta property="dcterms:modified">{w["made"]}T00:00:00Z</meta></metadata>'
           f'<manifest>{manifest}</manifest><spine>' + ''.join(f'<itemref idref="i{k}"/>' for k in range(len(order))) + '</spine></package>\n')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        def put(name, data, compress=zipfile.ZIP_DEFLATED):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0)); info.compress_type = compress
            z.writestr(info, data)
        put('mimetype', 'application/epub+zip', zipfile.ZIP_STORED)
        put('META-INF/container.xml', '<?xml version="1.0"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
                                      '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n')
        put('OEBPS/content.opf', opf)
        for name in sorted(files): put(f'OEBPS/{name}', files[name])
    return buf.getvalue()


def main() -> int:
    check = '--check' in sys.argv
    stale = []
    works = [marcus(), seneca()]
    if (ROOT / 'content/aurelius/translation/ru-v1.json').exists():
        works += [russian(works[0], 'marcus-meditations-ru-v1', 'Марк Аврелий. Размышления', 'Русский перевод с нового английского перевода проекта (ru-v1)', 'Марк Аврелий', f'{SITE}/apps/stoic-translation.html'),
                  russian(works[1], 'seneca-letters-selection-ru-v1', 'Сенека. Нравственные письма к Луцилию: избранное', 'Русский перевод с нового английского перевода проекта (ru-v1)', 'Сенека', f'{SITE}/apps/stoic-constitution.html')]
    for w in works:
        for ext, data in (('md', markdown(w).encode()), ('txt', text(w).encode()), ('epub', epub(w))):
            path = OUT / f'{w["slug"]}.{ext}'
            if check:
                if not path.exists() or path.read_bytes() != data: stale.append(path.name)
                continue
            OUT.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
            print(f'wrote {path.relative_to(ROOT)} ({len(data) // 1024} KB)')
    if check:
        print('downloads up to date' if not stale else f'downloads out of date: {stale}; run scripts/aurelius-downloads.py')
        return 1 if stale else 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
