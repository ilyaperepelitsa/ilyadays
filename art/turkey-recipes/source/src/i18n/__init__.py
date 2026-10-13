"""Translations for the recipe site (stdlib only).

Tables live in src/i18n/<lang>/<scope>.json as {English string: translation}:
  ui.json      UI strings in build.py ("Ingredients", "Step by step", time units …)
  site.json    site-level content from content.py (group names, noodle notes, sous vide tables)
  <slug>.json  one per recipe: every string a reader sees on that page (inline HTML kept as is)

Keys are the exact English strings, so when an English string changes its translation is simply missing:
the build falls back to English and lists what's missing at the end — it never fails.

    RECIPES_LANG=ru python3 build.py                     # Russian build (prints missing strings)
    RECIPES_LANG=ru RECIPES_I18N_SYNC=1 python3 build.py # also rewrite the tables: new strings added as "",
                                                         # strings no longer used dropped
    python3 src/i18n/tool.py todo ru <scope>             # numbered untranslated strings, for filling in
    python3 src/i18n/tool.py fill ru <scope> <file.json> # {number: translation} → table
"""
import json
import re
from dataclasses import replace
from pathlib import Path

HERE = Path(__file__).resolve().parent
_TAGS = re.compile(r"<[^>]+>|&\w+;")
_LETTER = re.compile(r"[^\W\d_]")
# Rule-based strings that repeat everywhere (mise "goes in" labels).
RULES = {
    "ru": [(re.compile(r"^Step (\d+)$"), r"Шаг \1"),
           (re.compile(r"^Steps (\d+)\s*[–-]\s*(\d+)$"), r"Шаги \1–\2"),
           (re.compile(r"^Steps (\d+) (?:and|&) (\d+)$"), r"Шаги \1 и \2")],
}


def _key(html):
    return re.sub(r"\s+", " ", _TAGS.sub(" ", html)).strip().lower()


class Translator:
    def __init__(self, lang):
        self.lang = lang
        self.tables, self.seen, self.missing = {}, {}, {}
        if lang != "en":
            for f in sorted((HERE / lang).glob("*.json")):
                self.tables[f.stem] = json.loads(f.read_text(encoding="utf-8"))

    def __call__(self, s, scope="ui"):
        if self.lang == "en" or not isinstance(s, str) or not _LETTER.search(_TAGS.sub("", s)):
            return s
        for pat, rep in RULES.get(self.lang, []):
            if pat.match(s):
                return pat.sub(rep, s)
        self.seen.setdefault(scope, {})[s] = None
        got = self.tables.get(scope, {}).get(s)
        if got:
            return got
        self.missing.setdefault(scope, {})[s] = None
        return s

    def report(self):
        """Print what's missing (and whether tables were synced). Returns the count."""
        n = sum(len(v) for v in self.missing.values())
        if self.lang != "en":
            if n:
                print(f"i18n[{self.lang}]: {n} untranslated string(s), shown in English:")
                for scope, keys in self.missing.items():
                    print(f"  {scope}: {len(keys)}")
                    for k in list(keys)[:5]:
                        print(f"    - {k[:100]}")
            else:
                print(f"i18n[{self.lang}]: all strings translated")
        return n

    def sync(self):
        """Rewrite the tables to exactly the strings this build used (keeps existing translations)."""
        d = HERE / self.lang
        d.mkdir(parents=True, exist_ok=True)
        for scope, keys in self.seen.items():
            old = self.tables.get(scope, {})
            new = {k: old.get(k, "") for k in keys}
            stale = [k for k in old if k not in new and old[k]]
            if stale:
                print(f"i18n sync {scope}: dropped {len(stale)} translation(s) whose English changed or went away")
            (d / f"{scope}.json").write_text(json.dumps(new, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def localize(r, T):
    """A copy of recipe r with every reader-facing string translated (scope = its slug).

    Ingredient names map through one table, and Step.uses / ingredient sub-list items that name an ingredient
    reuse that translation, so amounts.annotate() still matches them up."""
    if T.lang == "en":
        return r

    def t(x):
        return T(x, r.slug)

    names = {}
    ingredients = []
    for title, items in r.ingredients:
        row = []
        for n, a in items:
            names[_key(n)] = rn = t(n)
            row.append((rn, t(a)))
        ingredients.append((t(title), row))

    def sub(x):
        k = _key(x)
        if "<" not in x and k in names and "<" not in names[k]:
            ru = names[k]
            return ru[:1].lower() + ru[1:] if x[:1].islower() else ru
        return t(x)

    def body(b):
        if isinstance(b, (list, tuple)):
            return [(t(it[0]), [sub(x) for x in it[1]]) if isinstance(it, tuple) else t(it) for it in b]
        return t(b)

    steps = [replace(s, title=t(s.title), body=body(s.body), heat=s.heat if s.heat == "off" else t(s.heat),
                     time=t(s.time), part=t(s.part), uses=[names.get(_key(u), u) for u in s.uses],
                     amounts={names.get(_key(n), n): t(a) for n, a in s.amounts.items()},
                     diagram=s.diagram.localized(t) if hasattr(s.diagram, "localized") else s.diagram)
             for s in r.steps]
    vin = ({k: {f: t(v) if isinstance(v, str) else v for f, v in d.items()} for k, d in r.vinegar_options.items()}
           if r.vinegar_options else r.vinegar_options)
    return replace(
        r, title=t(r.title), blurb=t(r.blurb), yields=t(r.yields), total=t(r.total), intro=t(r.intro),
        ingredients=ingredients, steps=steps,
        mise=[replace(b, name=t(b.name), items=t(b.items), goes_in=t(b.goes_in)) for b in r.mise],
        timeline=[replace(x, label=t(x.label)) for x in r.timeline], timeline_note=t(r.timeline_note),
        equipment=[t(e) for e in r.equipment], notes=[(t(a), body(b)) for a, b in r.notes],
        sources=[(t(a), u) for a, u in r.sources], before_ingredients=t(r.before_ingredients),
        vinegar_options=vin,
        batch={**r.batch, "text": {k: t(v) for k, v in r.batch["text"].items()}} if r.batch else r.batch)
