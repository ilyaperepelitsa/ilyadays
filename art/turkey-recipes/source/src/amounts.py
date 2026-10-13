"""Per-step ingredient amounts: each Step lists the ingredient names it uses (Step.uses), and the
build looks their amounts up in the recipe's ingredient list. Set by hand — automatic matching
guessed wrong too often (e.g. "while the chicken finishes marinating" is not a use of chicken).
suggest() is an authoring aid that proposes a starting list from the step text.
"""
import re

from prose import plain
from quantities import SCALE_GROUP, mark


def _key(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip().lower()


def step_uses(recipe, step, marked=False):
    """[(name_html, amount_html)] for step.uses, in the order given. Unknown names fail the build.
    marked: amounts shortened (see short) with their quantities marked up for the portions control."""
    rows = {_key(n): (n, mark(short(a), not SCALE_GROUP.search(t)) if marked else a)
            for t, items in recipe.ingredients for n, a in items}
    out = []
    for name in step.uses:
        if _key(name) not in rows:
            raise KeyError(f"{recipe.slug}: step '{step.title}' uses unknown ingredient {name!r}")
        label, amount = rows[_key(name)]
        if name in step.amounts:
            amount = mark(step.amounts[name]) if marked else step.amounts[name]
        out.append((label, amount))
    return out


def short(amount):
    """'150 g (about 1–2 fillets), 2–3 cm pieces' → '150 g'. HTML amounts (live vinegar values) stay as they are."""
    if "<" in amount:
        return amount
    a = re.sub(r"\s*\(([^()]{13,})\)", "", amount)  # drop long asides, keep short ones like (~60 g)
    return a.split(", ")[0].strip()


def annotate(recipe, step):
    """Step body with amounts put next to sub-list items that name a used ingredient, plus the
    (name, amount) rows still left for the 'For this step' box. Amounts come shortened and marked up (quantities.py)."""
    rows = step_uses(recipe, step, marked=True)
    left = list(rows)
    body = step.body
    if isinstance(body, list):
        new = []
        for it in body:
            if isinstance(it, tuple):
                lead, subs = it
                out = []
                for sub in subs:
                    hit = next(((n, a) for n, a in left if _key(n) == _key(sub)), None)
                    if hit:
                        left.remove(hit)
                        sub = f'{sub} <span class="amt">{hit[1]}</span>'
                    out.append(sub)
                it = (lead, out)
            new.append(it)
        body = new
    return body, left


def suggest(recipe, step):
    """Ingredient names whose first or last distinctive word appears in the step text (review by hand!)."""
    text = _key(plain(step.body) + " " + step.title)
    hits = []
    for _, items in recipe.ingredients:
        for n, _ in items:
            words = re.findall(r"[a-z][a-z\-]+", re.sub(r"\(.*?\)", "", _key(n)))
            if any(re.search(rf"(?<![a-z]){re.escape(w)}s?(?![a-z])", text) for w in words[:1] + words[-1:]
                   if len(w) > 2):
                hits.append(re.sub(r"<[^>]+>", "", n))
    return hits
