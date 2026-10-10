#!/usr/bin/env python3
"""Export the recipe site as JSON for the ilyadays.com Next.js app (stdlib only).

    python3 export_json.py --out ../ilyadays/content --images-out ../ilyadays/public/media

Writes, for each language (en, ru):
  <out>/<lang>/index.json            groups and ordered recipe summaries
  <out>/<lang>/recipes/<slug>.json   everything a recipe page shows, fully resolved (HTML already through prose/annotate)
  <out>/<lang>/sous-vide.json        the quick-tables page
  <out>/<lang>/ui.json               every UI string {English: shown text}
  <out>/svg-defs.svg                 shared gradients/filters the inline SVG fallbacks refer to (put once on the page)

Image paths are relative to one images root ("illustrations/<slug>/3-how1.webp", "share/<slug>.jpg",
"photos/<slug>/2.jpg", "assets/….pdf"); the referenced files are copied there (--images-out).
Inline links inside HTML still point at "<slug>.html" / "sous-vide.html" (the old page names).

Same rendering code as build.py — this only collects its pieces as data. Checks at the end: untranslated strings per
Russian file (falls back to English, never fails) and that every referenced image exists.
"""
import argparse
import hashlib
import json
from html import escape
import shutil
import sys
from pathlib import Path

import build as B
from build import ROOT
from i18n import Translator, localize
from prose import plain, prose
from amounts import annotate
import quantities as QT
from art import defs_svg
from content import ADDED, GROUPS, NOODLE_PREP, NOODLE_SHOPPING, RECIPES, SOUS_VIDE, SV_INTRO, SV_PDF, sous_vide_hero

LANGS = ("en", "ru")
UI_KEYS = list(json.loads((ROOT / "src" / "i18n" / "ru" / "ui.json").read_text(encoding="utf-8")))
SOURCES = {"illustrations": B.WEB, "share": B.SHARE, "photos": ROOT / "photos", "assets": ROOT / "assets"}


class Images:
    """Collects every image path the JSON refers to, so they can be checked and copied."""

    def __init__(self):
        self.paths = set()

    def __call__(self, path):
        """The path as the JSON refers to it, with ?v=<content hash> so a regenerated picture gets a new URL
        (the site caches media for a day and serves it stale for a week)."""
        if not path:
            return path
        self.paths.add(path)
        src = self.source(path)
        return f"{path}?v={hashlib.sha1(src.read_bytes()).hexdigest()[:10]}" if src.is_file() else path

    def source(self, path):
        top, rest = path.split("/", 1)
        return SOURCES[top] / rest


def setup(lang):
    """Point build.py's module state at one language (it reads these globals at call time)."""
    B.LANG, B.T, B.ASSETS = lang, Translator(lang), ""
    B.LOC.clear()
    B.LOC.update({r.slug: localize(r, B.T) for r in RECIPES})


def ordered():
    """Recipes in index order: by group, then as listed in content.RECIPES."""
    return [B.LOC[r.slug] for g in GROUPS for r in RECIPES if r.group == g]


def chips(r):
    """The yield and time chips; html has the yield's quantities marked up (converted, never scaled)."""
    return [{"text": r.yields, "html": QT.chip(r.yields), "kind": ""},
            {"text": r.total, "html": escape(r.total), "kind": "time"}]


def hero(r, img):
    illo = img(B.illo_for(r.slug, "hero"))
    return {"image": illo, "svg_fallback": None if illo else B.hero_svg(r), "alt": r.title}


def summary(r, img):
    return {"slug": r.slug, "kind": "recipe", "title": r.title, "group": B.site(r.group), "group_id": B.gid(r.group),
            "blurb_html": r.blurb, "description": plain(r.blurb), "yields": r.yields, "total": r.total,
            "chips": chips(r), "hero": hero(r, img), "share_image": img(B.share_image(r.slug)),
            "added": ADDED.get(r.slug)}


def recent(order, n=12):
    """The n newest slugs by content.ADDED, newest first (ties keep index order)."""
    dated = [r.slug for r in order if r.slug in ADDED]
    return sorted(dated, key=lambda s: ADDED[s], reverse=True)[:n]


def mise(r, img):
    out = []
    for i, b in enumerate(r.mise, 1):
        src = img(B.illo_for(r.slug, f"mise{i}"))
        parts = [QT.mark(p.strip()) for p in b.items.split("·")] if b.items else []
        out.append({"name": b.name, "items_html": QT.mark(b.items), "items": parts, "as_list": len(parts) >= 3,
                    "goes_in": b.goes_in, "vessel": b.vessel, "image": src,
                    "svg_fallback": None if src else B.mise_art(b)})
    return out


def timeline(r):
    if not r.timeline:
        return None
    d = B.timeline_data(r)
    return {"tasks": [{"label": t.label, "label_html": QT.mark(escape(t.label), False), "start": t.start, "dur": t.dur, "dur_label": B.fmt_dur(t.dur), "kind": t.where}
                      for t in d["tasks"]],
            "end": d["end"], "tick_step": d["step"], "hours": d["hours"], "unit": d["unit"],
            "ticks": [{"at": m, "label": label} for m, label in d["ticks"]],
            "legend": [{"kind": w, "label": label} for w, label in d["legend"]],
            "note_html": r.timeline_note or None}


def steps(r, img):
    out, captions = [], B.step_captions(r)
    for i, s in enumerate(r.steps, 1):
        body, left = annotate(r, s)
        im = B.step_images(r, i, s, captions)
        out.append({
            "n": i, "id": f"step-{i}", "title": s.title,
            "part": s.part or None, "part_id": f"part-{B.gid(s.part)}" if s.part else None,
            "heat": ({"label": B.ui("heat off") if s.heat == "off" else s.heat, "off": s.heat == "off",
                      "label_html": escape(B.ui("heat off")) if s.heat == "off" else QT.chip(s.heat)}
                     if s.heat else None),
            "time": s.time or None,
            "time_html": QT.chip(s.time) if s.time else None,
            "body_html": QT.mark(prose(body), False),
            "uses_rows": [{"name_html": n, "amount_html": a} for n, a in left],
            "images": {"photo": img(im["photo"]),
                       "how": [{"src": img(src), "caption": cap} for src, cap in im["how"]],
                       "result": img(im["result"]), "illustration": img(im["illustration"]),
                       "svg_fallback": im["svg"], "diagram": im["diagram"],
                       "diagram_title": im["diagram_title"], "alt": im["alt"],
                       **({"zoomable": True} if im["zoomable"] else {})}})
    return out


def scale(r):
    """The portions control: people / batch / none (nothing to scale), base servings and its strings."""
    info = QT.scale_info(r, B.ui)
    if not info["scalable"]:
        info["mode"] = "none"
    one = B.ui("one batch")
    info["size"] = one if info["mode"] == "batch" else f'{info["serves"]:g}'
    return info


def recipe(r, order, img):
    i = [x.slug for x in order].index(r.slug)
    link = (lambda x: {"slug": x.slug, "title": x.title})
    group = B.site(r.group)
    return {
        "slug": r.slug, "title": r.title, "description": plain(r.blurb), "blurb_html": r.blurb,
        "group": {"id": B.gid(r.group), "name": group},
        "intro_html": QT.mark(r.intro, False), "yields": r.yields, "total": r.total, "chips": chips(r),
        "hero": hero(r, img), "share_image": img(B.share_image(r.slug)),
        "before_ingredients_html": r.before_ingredients or None,
        "ingredients": [{"name": t, "items": [{"name_html": n, "amount_html": a} for n, a in items]}
                        for t, items in QT.mark_ingredients(r)],
        "equipment_html": [QT.mark(e, False) for e in r.equipment],
        "vinegar_options": QT.mark_vinegar(r.vinegar_options),
        "scale": scale(r),
        "batch": r.batch,
        "mise": mise(r, img),
        "timeline": timeline(r),
        "parts": [{"id": f"part-{B.gid(p)}", "title": p} for p in dict.fromkeys(s.part for s in r.steps if s.part)],
        "steps": steps(r, img),
        "notes": [{"title_html": t, "html": QT.mark(prose(h), False)} for t, h in r.notes],
        "sources": [{"label": t, "url": u} for t, u in r.sources],
        "original": {"label": B.ui("Original notes (Russian)"), "text": r.original} if r.original else None,
        "siblings": [link(B.LOC[x.slug]) for x in RECIPES if x.group == r.group and x.slug != r.slug],
        "more_label": B.more_label(group),
        "prev": link(order[i - 1]) if i > 0 else None,
        "next": link(order[i + 1]) if i + 1 < len(order) else None,
    }


def sv_hero(img):
    """The sous vide page's generated hero (imagegen/recipes/sous_vide.py), else the SVG."""
    illo = img(B.illo_for("sous-vide", "hero"))
    return {"image": illo, "svg_fallback": None if illo else sous_vide_hero(), "alt": B.site("Sous vide quick tables")}


def sv_summary(img):
    return {"slug": "sous-vide", "kind": "reference", "title": B.site("Sous vide quick tables"),
            "group": B.site("Sous vide"), "group_id": B.gid("Sous vide"),
            "blurb_html": B.site("Times and temperatures: asparagus, cauliflower, chicken breast & drumsticks, "
                                 "ribeye, pork ribs, lamb."),
            "description": B.site("Sous vide times and temperatures"), "yields": None, "total": None,
            "chips": [{"text": B.ui("reference"), "kind": ""}, {"text": B.ui("PDF included"), "kind": ""}],
            "hero": sv_hero(img), "share_image": img(B.share_image("sous-vide") or B.share_image("sous-vide-beets")),
            "added": ADDED.get("sous-vide")}


def index(order, img):
    groups = []
    for g in GROUPS:
        notes = []
        if g == "Rice noodles":
            notes = [{"title_html": B.site("Noodles first (the stir-fries)"), "html": prose(B.site_body(NOODLE_PREP))},
                     {"title_html": B.site("Extra shopping for the stir-fries"), "html": prose(B.site_body(NOODLE_SHOPPING))}]
        groups.append({"id": B.gid(g), "name": B.site(g),
                       "items": (["sous-vide"] if g == "Sous vide" else []) + [r.slug for r in order if r.group == g],
                       "notes": notes})
    return {"title": B.ui("Recipes"),
            "lede_html": B.site("Japanese basics and big projects, sushi, Korean kimchi and fried chicken, weeknight "
                                "rice noodles and soba, Indian chicken tikka and a sous vide reference — each with "
                                "step-by-step pictures, mise-en-place order and a prep timeline."),
            "description": B.site("Japanese basics, ramen, sushi, Korean, rice noodles, soba, Indian and sous vide — step "
                                  "by step with pictures."),
            "share_image": img(B.share_image("oyakodon")),
            "groups": groups,
            "recent": recent(order),
            "recipes": [sv_summary(img)] + [summary(r, img) for r in order],
            "footer": B.ui("Tap ingredients and steps to tick them off while you cook.")}


def sous_vide(img):
    tables = [{"id": t["id"], "title": B.site(t["title"]),
               "cols": [{"label_html": B.site(c), "numeric": c in ("Temp", "Time")} for c in t["cols"]],
               "rows": [[B.site(v) for v in row] for row in t["rows"]],
               "states": ["frozen" if row[t["cols"].index("State")].startswith("Frozen") else "chilled" for row in t["rows"]],
               "after_html": [B.site(a) for a in t["after"]],
               "image": img(B.illo_for("sous-vide", t["id"]))} for t in SOUS_VIDE]
    return {"slug": "sous-vide", "title": B.site("Sous vide quick tables"),
            "description": B.site("Sous vide times and temperatures"),
            "group": {"id": B.gid("Sous vide"), "name": B.site("Sous vide")},
            "intro_html": B.site(SV_INTRO), "tables": tables,
            "pdf": {"src": img(SV_PDF.replace(".pdf", "_ru.pdf") if B.LANG == "ru" else SV_PDF), "title": B.ui("Printable tables"), "subtitle": B.ui("— v5, updated 2026-10-11"),
                    "open": B.ui("Open the PDF"), "download": B.ui("Download"),
                    "fallback": B.ui("Your browser can’t show the PDF inline — use the button above.")},
            "hero": sv_hero(img), "share_image": img(B.share_image("sous-vide") or B.share_image("sous-vide-beets"))}


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", required=True, type=Path, help="content directory (gets en/, ru/, svg-defs.svg)")
    ap.add_argument("--images-out", type=Path, help="images root to copy the referenced pictures into")
    a = ap.parse_args()
    img = Images()
    missing = {}
    for lang in LANGS:
        setup(lang)
        order = ordered()
        d = a.out / lang
        if d.exists():
            shutil.rmtree(d)
        write(d / "index.json", index(order, img))
        write(d / "sous-vide.json", sous_vide(img))
        for r in order:
            write(d / "recipes" / f"{r.slug}.json", recipe(r, order, img))
        write(d / "ui.json", {k: B.ui(k) for k in UI_KEYS})
        missing[lang] = B.T.missing
        print(f"{lang}: index, sous-vide, ui + {len(order)} recipes → {d}")
    (a.out / "svg-defs.svg").write_text(defs_svg() + "\n", encoding="utf-8")

    # untranslated strings, per Russian file (they're shown in English)
    files = {"ui": "ui.json + all pages", "site": "index.json / sous-vide.json"}
    ru = missing["ru"]
    total = sum(len(v) for v in ru.values())
    print(f"ru: {total} untranslated string(s)" + ("" if total else " — every file fully Russian"))
    for scope, keys in sorted(ru.items()):
        print(f"  {files.get(scope, f'recipes/{scope}.json')}: {len(keys)}")
        for k in list(keys)[:5]:
            print(f"    - {k[:100]}")

    # every recipe has a date in content.ADDED (the home page's "Recently added")
    for r in RECIPES:
        if r.slug not in ADDED:
            print(f"no date in content.ADDED: {r.slug} — it won't show in Recently added")

    # ingredient amounts the portions control can't scale (shown as written at any size) — should all be vague
    vague = sorted({a for r in RECIPES for _, items in r.ingredients for _, a in items if a and QT.unparsed(a)})
    print(f"portions: {len(vague)} ingredient amount(s) left as written: " + " · ".join(vague))

    # every referenced image exists (and is copied)
    gone = sorted(p for p in img.paths if not img.source(p).exists())
    for p in gone:
        print(f"missing image: {p}")
    if a.images_out:
        n = 0
        for p in sorted(img.paths):
            src, dst = img.source(p), a.images_out / p
            if src.exists() and (not dst.exists() or dst.stat().st_size != src.stat().st_size
                                 or dst.stat().st_mtime < src.stat().st_mtime):
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                n += 1
        print(f"images: {len(img.paths)} referenced, {len(gone)} missing, {n} copied → {a.images_out}")
    else:
        print(f"images: {len(img.paths)} referenced, {len(gone)} missing (no --images-out, nothing copied)")
    return 1 if gone else 0


if __name__ == "__main__":
    sys.exit(main())
