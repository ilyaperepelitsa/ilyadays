#!/usr/bin/env python3
"""Acceptance gates for the Stoic Constitution: what the build and the tests do not already check.

  aurelius-qa.py article <article.json | number> [--audit audit.md]   one article (a file, or a number in the record)
  aurelius-qa.py articles                                              every article in the record
  aurelius-qa.py translation [--section c3.s2] [--folder <scratch folder>]
                                                                       the stored translation, one section, or a
                                                                       settled scratch folder before it is merged
  aurelius-qa.py --json …                                              machine-readable output

The build (scripts/aurelius-constitution.py) already refuses a quote that is not one exact span, a `gives` phrase
that is not in its claim, a fused claim with one passage, an unexplained unused passage, and more. These gates add
the quality bar of plan 32 (W3 "Quality bar", the risks table, W4) and the writing rules of
apps/aurelius/prompts/constitution-article.md that can be checked mechanically. A finding is BLOCKING when a reader
would be misled or a stated rule is broken; WARNING when a person should look. Exit status 1 if anything blocks.

Each gate is a small function that takes the data and returns findings, so tests can feed it known faults
(apps/aurelius/tests/test_qa.py).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECORD = ROOT / 'content/aurelius/constitution.json'
STORE = ROOT / 'content/aurelius/translation/project-v1.json'
TOPICS = ROOT / 'content/aurelius/topics.json'

OLD = re.compile(r'\b(thee|thou|thy|thine|doth|hath|saith|unto|whatsoever|shalt|art thou|ye)\b', re.I)
STRAIGHT = re.compile(r'["\']')
PAUSE_DASH = re.compile(r' [–—] |—')
FIRST_PERSON = re.compile(r"\b(I|me|my|mine|myself|we|us|our)\b|\bI’")
LATIN_IN_GREEK = re.compile(r'[Ͱ-Ͽἀ-῿][A-Za-z]|[A-Za-z][Ͱ-Ͽἀ-῿]')
STOP = set('a an the and or of to in on for with as is are be it that this what which who by from at not no my i me we our us its it’s'.split())


def finding(level: str, where: str, rule: str, text: str) -> dict:
    return {'level': level, 'where': where, 'rule': rule, 'text': text}


def words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z’]+", s.lower()) if w not in STOP and len(w) > 2}


# ---------------------------------------------------------------- articles

def gate_typography(article: dict) -> list[dict]:
    """Every reader-facing sentence: curly quotes, no dash as a pause, no archaic forms (rules 3, 4; typography)."""
    out = []
    n = article['number']

    def look(where, text):
        if not isinstance(text, str):
            return
        if STRAIGHT.search(text):
            out.append(finding('BLOCKING', where, 'typography', f'straight quote in “{text[:70]}”'))
        if PAUSE_DASH.search(text):
            out.append(finding('BLOCKING', where, 'typography', f'dash used as a pause in “{text[:70]}”'))
        own = re.sub(r'“[^”]*”', '', text)   # words quoted from a translation are not the editor's own
        if OLD.search(own):
            out.append(finding('BLOCKING', where, 'plain words', f'archaic form “{OLD.search(own).group(0)}” in “{text[:70]}”'))

    look(f'a{n} title', article['title'])
    st = article['statement']
    for k in ('t', 'kind', 'form'):
        look(f'a{n} statement.{k}', st.get(k))
    for c in article['claims']:
        for k in ('role', 't', 'shared', 'changed'):
            look(f'a{n} {c["id"]}.{k}', c.get(k))
        for p in c['support']:
            look(f'a{n} {p["id"]}.follows', p['follows'])
            look(f'a{n} {p["id"]}.note', p.get('note'))
    for s in article['single']:
        for k in ('label', 't', 'why', 'follows'):
            look(f'a{n} {s["id"]}.{k}', s.get(k))
    for i, d in enumerate(article.get('decisions', [])):
        look(f'a{n} decisions[{i}]', d)
    look(f'a{n} limit', article.get('limit'))
    for k, v in (article.get('empty') or {}).items():
        look(f'a{n} empty.{k}', v)
    for k, v in (article.get('aside') or {}).items():
        look(f'a{n} aside.{k}', v)
    v = (article.get('voices') or {}).get('seneca')
    if v:
        for k in ('becomes', 'statement'):
            look(f'a{n} seneca.{k}', v.get(k))
        for it in v.get('items', []):
            for k in ('t', 'why', 'role', 'follows', 'context'):
                look(f'a{n} seneca {it.get("id") or it.get("key")}.{k}', it.get(k))
            for p in it.get('support', []):
                look(f'a{n} seneca {p["id"]}.follows', p.get('follows'))
                look(f'a{n} seneca {p["id"]}.context', p.get('context'))
        for a in v.get('amend', []):
            look(f'a{n} seneca amend {a["target"]}', a.get('t'))
    return out


def gate_voice(article: dict) -> list[dict]:
    """The article speaks in the first person (rule 3); the statement is 30 to 140 characters (W3 step 7)."""
    out, n = [], article['number']
    t = article['statement']['t']
    if not 30 <= len(t) <= 140:
        out.append(finding('BLOCKING', f'a{n} statement', 'statement length', f'{len(t)} characters; the bar is 30 to 140'))
    if not FIRST_PERSON.search(t):
        out.append(finding('BLOCKING', f'a{n} statement', 'first person', f'“{t}” is not in the first person'))
    for c in article['claims']:
        if not FIRST_PERSON.search(c['t']):
            out.append(finding('WARNING', f'a{n} {c["id"]}', 'first person', f'claim is not in the first person: “{c["t"][:80]}”'))
        if not c['t'].rstrip().endswith(('.', '?', '”')):
            out.append(finding('BLOCKING', f'a{n} {c["id"]}', 'complete sentences', 'claim does not end as a sentence'))
    for s in article['single']:
        if not FIRST_PERSON.search(s['t']):
            out.append(finding('WARNING', f'a{n} {s["id"]}', 'first person', f'said-once item is not in the first person: “{s["t"][:80]}”'))
    return out


def gate_fusion(article: dict) -> list[dict]:
    """A fused claim must have words that two of its passages both back (rule 1; plan 32 risks table: a claim whose
    `gives` phrases all come from one quote is a paraphrase). Counts shared components as the tests do."""
    out, n = [], article['number']
    shared_total = comp_total = 0
    for c in article['claims']:
        t = c['t'].lower()
        cover = [set() for _ in t]
        backers = set()
        for p in c['support']:
            ref = p['id'].rstrip('abcdefghijklmnopqrstuvwxyz')
            for g in p.get('gives', []):
                at = t.find(g.lower())
                if at < 0:
                    continue
                backers.add(ref)
                for i in range(at, at + len(g)):
                    cover[i].add(ref)
        keys = ['|'.join(sorted(s)) for s in cover]
        comps = shared = 0
        for i, k in enumerate(keys):
            if k and k != (keys[i - 1] if i else None):
                comps += 1
                shared += '|' in k
        comp_total += comps
        shared_total += shared
        if len(backers) < 2:
            out.append(finding('BLOCKING', f'a{n} {c["id"]}', 'fusion', f'only {len(backers)} passage(s) back words of the claim through `gives`: a paraphrase of one passage, not a fusion'))
        elif shared == 0:
            out.append(finding('BLOCKING', f'a{n} {c["id"]}', 'fusion', 'no words of the claim are backed by two passages; name the words they share or make the points said-once items'))
    if comp_total and shared_total * 3 < comp_total:
        out.append(finding('WARNING', f'a{n}', 'shared components', f'{shared_total} of {comp_total} claim components rest on two or more passages; the bar is a third'))
    return out


def gate_follows(article: dict, passages: dict[str, str] | None = None) -> list[dict]:
    """Every “what follows” is one plain sentence under 170 characters (rule 9) and is not the quote copied back."""
    out, n = [], article['number']
    pieces = [p for c in article['claims'] for p in c['support']] + article['single']
    for p in pieces:
        f = p['follows']
        if not (20 < len(f) < 170 and f.rstrip().endswith('.')):
            out.append(finding('BLOCKING', f'a{n} {p["id"]}', 'what follows', f'{len(f)} characters, must be one sentence of 21 to 169 ending with a full stop'))
        q, fw = words(p['quote']), words(f)
        if fw and q and len(fw & q) / len(fw) > 0.9 and len(fw) > 4:
            out.append(finding('WARNING', f'a{n} {p["id"]}', 'what follows', 'repeats the quote almost word for word; it should say what follows from it'))
        if f.count('. ') > 1:
            out.append(finding('WARNING', f'a{n} {p["id"]}', 'what follows', 'more than one sentence'))
    return out


def gate_accounting(article: dict) -> list[dict]:
    """Decisions, limit, empty labels and set-aside reasons are real sentences (W3 steps 6 and 8)."""
    out, n = [], article['number']
    d = article.get('decisions', [])
    if not 2 <= len(d) <= 6:
        out.append(finding('WARNING', f'a{n} decisions', 'decisions', f'{len(d)} decisions; two to four is the plan'))
    lim = article.get('limit', '')
    if len(lim) < 40:
        out.append(finding('BLOCKING', f'a{n} limit', 'limit', 'the article must say where it is weak'))
    for k in ('why', 'action', 'practice', 'breaks', 'doubt'):
        if not article['groups'].get(k) and len((article.get('empty') or {}).get(k, '')) < 25:
            out.append(finding('BLOCKING', f'a{n} empty.{k}', 'empty label', 'an empty label needs a sentence saying why'))
    for ref, why in (article.get('aside') or {}).items():
        if len(why) < 25:
            out.append(finding('BLOCKING', f'a{n} aside.{ref}', 'set aside', 'the reason is too short to be a sentence'))
    if article.get('edition') != 'project-v1':
        out.append(finding('BLOCKING', f'a{n}', 'edition', 'every article quotes the new English: set "edition": "project-v1"'))
    return out


def gate_seneca(article: dict) -> list[dict]:
    """Seneca's part (W4, rules 12 to 18): every piece read in context, clauses that continue the sentence, a clause
    for every wider or qualified item, and the two strip sentences."""
    out, n = [], article['number']
    v = (article.get('voices') or {}).get('seneca')
    if not v:
        return [finding('WARNING', f'a{n}', 'seneca', 'no Seneca part')]
    items = v.get('items', [])
    if not items:
        out.append(finding('WARNING', f'a{n}', 'seneca', 'the Seneca part has no items'))
    if not (v.get('becomes', '').startswith('With Seneca')):
        out.append(finding('BLOCKING', f'a{n} seneca.becomes', 'seneca', 'must begin “With Seneca, …”'))
    if len(v.get('statement', '')) < 20:
        out.append(finding('BLOCKING', f'a{n} seneca.statement', 'seneca', 'must say how the statement changes, or that it stands'))
    searched = v.get('searched') or {}
    if len(searched.get('searches', [])) < 3:
        out.append(finding('BLOCKING', f'a{n} seneca.searched', 'seneca', 'at least three word searches are logged'))
    keyed = {}
    for it in items:
        pieces = [it] if 'quote' in it else it.get('support', [])
        for p in pieces:
            ctx = p.get('context', '')
            if not 20 <= len(ctx) <= 200:
                out.append(finding('BLOCKING', f'a{n} {p.get("id")}', 'seneca context', f'context must be 20 to 200 characters ({len(ctx)})'))
        if it['effect'] == 'stronger' and not it.get('gives'):
            out.append(finding('BLOCKING', f'a{n} {it.get("id")}', 'seneca', 'a backing item names the words of the claim it backs'))
        if it.get('key'):
            keyed[it['key']] = it
    needs_clause = any(it['effect'] in ('wider', 'qualified') for it in items)
    amend = v.get('amend', [])
    if needs_clause and not amend:
        out.append(finding('BLOCKING', f'a{n} seneca.amend', 'seneca clause', 'a wider or qualified item needs at least one clause in the body'))
    for a in amend:
        t = a.get('t', '')
        if not (t.startswith((', ', '; ', ' — ')) and 20 <= len(t) <= 140 and not t.rstrip().endswith('.')):
            out.append(finding('BLOCKING', f'a{n} amend {a.get("target")}', 'seneca clause', 'a clause starts with “, ” or “; ”, is 20 to 140 characters and has no full stop'))
        if a.get('kind') in ('challenges', 'limits') and not all(keyed.get(k, {}).get('effect') == 'qualified' for k in a.get('from', [])):
            out.append(finding('BLOCKING', f'a{n} amend {a.get("target")}', 'seneca clause', 'a limiting or challenging clause must come from a qualified item'))
    return out


def gate_repetition(article: dict, others: list[dict]) -> list[dict]:
    """Nothing in an article repeats a claim of an earlier article in other words (W3 quality bar). A word-overlap
    screen: a person decides; the article's `limit` should name the other article when it shares ground."""
    out, n = [], article['number']
    mine = [('statement', article['statement']['t'])] + [(c['id'], c['t']) for c in article['claims']]
    for o in others:
        if o['number'] == n:
            continue
        theirs = [('statement', o['statement']['t'])] + [(c['id'], c['t']) for c in o['claims']]
        for a_id, a_t in mine:
            for b_id, b_t in theirs:
                wa, wb = words(a_t), words(b_t)
                if len(wa) >= 4 and len(wb) >= 4:
                    j = len(wa & wb) / len(wa | wb)
                    if j >= 0.45:
                        named = f'Article {o["number"]}' in article.get('limit', '')
                        out.append(finding('WARNING' if named else 'BLOCKING', f'a{n} {a_id}', 'repetition',
                                           f'shares {j:.0%} of its words with Article {o["number"]} {b_id} (“{b_t[:70]}”)'
                                           + ('' if named else '; if the ground is shared, say so in `limit` and name that article')))
    return out


AUDIT_PARTS = [('for the owner', r'for the owner'), ('shared words', r'share|shared'), ('count of shared components', r'component'),
               ('nearby articles', r'article\s+\d+|near'), ('seneca', r'seneca')]


def gate_audit(article: dict, audit: str | None) -> list[dict]:
    """The writer's audit is the owner's way in (ARTICLE.md, hand back): all five parts are present."""
    n = article['number']
    if audit is None:
        return [finding('BLOCKING', f'a{n} audit.md', 'audit', 'no audit')]
    low = audit.lower()
    return [finding('BLOCKING', f'a{n} audit.md', 'audit', f'part missing: {name}') for name, pat in AUDIT_PARTS if not re.search(pat, low)]


def check_article(article: dict, others: list[dict], audit: str | None = '', with_audit: bool = False) -> list[dict]:
    out = []
    for gate in (gate_typography, gate_voice, gate_fusion, gate_follows, gate_accounting, gate_seneca):
        out += gate(article)
    out += gate_repetition(article, others)
    if with_audit:
        out += gate_audit(article, audit)
    return out


# ---------------------------------------------------------------- translation

def glossary() -> list[tuple[str, str]]:
    """(Greek stem, required English) pairs from the settled glossary, for the plain one-word cases."""
    return [('κόσμ', 'universe'), ('ἡγεμονικ', 'ruling part'), ('ὁρμ', 'impulse'), ('φαντασ', 'impression'),
            ('ὑπόληψ', 'judgment'), ('δόγμα', 'principle'), ('περαίνε', 'carried through'), ('κοινωνικ', 'social'), ('λογικ', 'rational')]


def check_passages(passages: list[dict], label: str) -> list[dict]:
    """Gates for settled translations, beyond the store's own rules and the scratch validator."""
    out = []
    for p in passages:
        r, g, e = p['standard_ref'] if 'standard_ref' in p else p['ref'], p['greek'], p['english']
        w = f'{label} {r}'
        for kind in ('notes', 'check'):
            for x in p.get(kind, []):
                if LATIN_IN_GREEK.search(x.get('greek', '')):
                    out.append(finding('BLOCKING', w, 'greek', f'a Latin letter inside a Greek word in a {kind[:-1]}: {x["greek"][:40]}'))
        if re.search(r'[Ͱ-Ͽἀ-῿]', e):
            out.append(finding('WARNING', w, 'english', 'Greek letters in the English (only where the passage is about a Greek word)'))
        if OLD.search(e):
            out.append(finding('BLOCKING', w, 'plain words', f'archaic form “{OLD.search(e).group(0)}”'))
        if STRAIGHT.search(e) or PAUSE_DASH.search(e):
            out.append(finding('BLOCKING', w, 'typography', 'straight quote or dash as a pause in the English'))
        notes_text = ' '.join(n['greek'] + ' ' + n['note'] for n in p.get('notes', []))
        for stem, eng in glossary():
            if stem in g and eng.split()[0] not in e.lower() and stem not in notes_text:
                out.append(finding('WARNING', w, 'glossary', f'the Greek has {stem}… but the English has no “{eng}” and no note explains another word'))
        for x in p.get('check', []):
            d = x.get('decided', '')
            if d.startswith('Declined:') and len(d) < 60:
                out.append(finding('WARNING', w, 'settling', f'a point declined with a short reason: “{d[:80]}”'))
        if not p.get('notes'):
            out.append(finding('BLOCKING', w, 'notes', 'no notes: every passage records where the Greek is open'))
    return out


def load_folder(folder: Path) -> list[dict]:
    greek = {x['ref']: x['greek'] for x in json.loads((folder / 'greek.json').read_text())}
    return [{**s, 'greek': greek[s['ref']]} for s in json.loads((folder / 'settled.json').read_text())]


# ---------------------------------------------------------------- command line

def report(found: list[dict], as_json: bool) -> int:
    blocking = [f for f in found if f['level'] == 'BLOCKING']
    if as_json:
        print(json.dumps({'blocking': blocking, 'warnings': [f for f in found if f['level'] != 'BLOCKING']}, ensure_ascii=False, indent=1))
    else:
        for f in sorted(found, key=lambda f: (f['level'] != 'BLOCKING', f['where'])):
            print(f"{f['level']:<8} {f['where']:<28} {f['rule']}: {f['text']}")
        print(f'{len(blocking)} blocking, {len(found) - len(blocking)} warnings')
    return 1 if blocking else 0


def main(argv: list[str]) -> int:
    as_json = '--json' in argv
    args = [a for a in argv if a != '--json']
    if not args:
        print(__doc__)
        return 2
    record = json.loads(RECORD.read_text())
    if args[0] == 'articles':
        found = []
        for a in record['articles']:
            found += check_article(a, record['articles'])
        return report(found, as_json)
    if args[0] == 'article':
        src = args[1]
        if src.isdigit():
            article, audit = next(a for a in record['articles'] if a['number'] == int(src)), None
            return report(check_article(article, record['articles']), as_json)
        article = json.loads(Path(src).read_text())
        audit_path = Path(args[args.index('--audit') + 1]) if '--audit' in args else Path(src).with_name('audit.md')
        audit = audit_path.read_text() if audit_path.exists() else None
        others = [a for a in record['articles'] if a['section'] != article['section']]
        return report(check_article(article, others, audit, with_audit=True), as_json)
    if args[0] == 'translation':
        if '--folder' in args:
            folder = Path(args[args.index('--folder') + 1])
            return report(check_passages(load_folder(folder), folder.name), as_json)
        store = json.loads(STORE.read_text())
        want = args[args.index('--section') + 1] if '--section' in args else None
        topics = json.loads(TOPICS.read_text())
        section_of = {m['revision_id']: s['id'] for c in topics['chapters'] for s in c['sections'] for m in s['members']}
        ps = [p for p in store['passages'] if not p.get('superseded') and (not want or section_of[p['casaubon_revision']] == want)]
        return report(check_passages(ps, want or 'store'), as_json)
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
