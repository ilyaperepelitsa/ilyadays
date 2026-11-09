#!/usr/bin/env python3
"""Fitness pictures (stream 07): technique sequences, joint-angle side views, machine pictures, muscle maps and the
section cover, made with OpenAI's Images API (gpt-image-2, webp) through the standard library only.

    python3 scripts/fitness-images.py plan   [--quality medium] [--model gpt-image-2]
    python3 scripts/fitness-images.py run    [--budget-usd 20] [--quality low|medium|high] [--priority N]
                                             [--angle sequence,side,machine,muscle-map,cover] [--only id-or-key,...]
                                             [--workers 3] [--dry-run] [--force] [--no-ref] [--ref PATH ...]
    python3 scripts/fitness-images.py status [--budget-usd 20]
    python3 scripts/fitness-images.py index  # rewrite content/fitness/images.json from the files on disk

Files (art/fitness unless noted):
    STYLE.md       house style; the fenced ```prompt <name>``` blocks are the prompt parts this script assembles
    scenes.json    per-exercise drawing data: machine as set up, setup, START/END, arrow path, hardest point, camera
    pricing.json   per-image prices and token rates with sources (cost estimates and the budget check)
    manifest.json  written by `plan`: every picture with its prompt, refs, size, quality, priority and cost
    spend.json     cumulative spend, saved after every image. `run` never lets it pass --budget-usd (default 20):
                   each request first reserves a conservative upper bound under a lock, so parallel workers and
                   repeated runs cannot pass the cap either
    prompts.json   append-only log of every request: exact prompt, model, size, quality, refs, cost, usage, outputs
    originals/     full-size API output (gitignored; replaced originals move to originals/_previous/)
Outputs: public/media/fitness/exercises/<id>/<angle>.webp, public/media/fitness/machines/<id>.webp (1200 px wide),
public/media/fitness/muscles/<group>.webp (800 px); the cover's original is art/covers/fitness.webp with copies in
public/covers (800 px) and public/share (1200x630 JPEG). content/fitness/images.json is rewritten after every run by
scripts/fitness-image-index.mjs.
Consistency: style anchors (machine-chest-press/sequence, machine-chest-press/side, machines/pec-deck, muscles/chest)
are generated first and passed to /v1/images/edits as the style reference for every later picture of their kind.
Needs OPENAI_API_KEY in the environment; it is never printed or written anywhere. cwebp/dwebp from libwebp.
"""
import argparse
import base64
import hashlib
import http.client
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art" / "fitness"
STYLE_MD = ART / "STYLE.md"
SCENES = ART / "scenes.json"
PRICING = ART / "pricing.json"
MANIFEST = ART / "manifest.json"
SPEND = ART / "spend.json"
PROMPT_LOG = ART / "prompts.json"
ORIGINALS = ART / "originals"
RUN_LOCK = ART / ".run.lock"
EXERCISES = ROOT / "content" / "fitness" / "exercises.json"
REGISTRY = ROOT / "content" / "fitness" / "registry.json"
INDEX_SCRIPT = ROOT / "scripts" / "fitness-image-index.mjs"
MEDIA = "public/media/fitness"
COVER_ART = "art/covers/fitness.webp"
COVER_PUBLIC = ROOT / "public" / "covers" / "fitness.webp"
COVER_SHARE = ROOT / "public" / "share" / "fitness.jpg"
COVER_REFS = ["art/covers/travel.webp", "art/covers/food.webp"]  # the two existing home tiles: same look

API = "https://api.openai.com/v1/images"
DEFAULT_MODEL = "gpt-image-2"
DEFAULT_BUDGET = 20.0
LANDSCAPE, SQUARE = "1536x1024", "1024x1024"
KINDS = ("sequence", "side", "machine", "muscle-map", "cover")
KIND_ORDER = {k: i for i, k in enumerate(KINDS)}
SIZES = {"sequence": LANDSCAPE, "side": LANDSCAPE, "machine": LANDSCAPE, "muscle-map": SQUARE, "cover": LANDSCAPE}
WIDTHS = {"sequence": 1200, "side": 1200, "machine": 1200, "muscle-map": 800, "cover": 800}  # optimized copies
STYLE_BLOCKS = ("base", "mannequin", "sequence", "sequence-pair", "side", "machine", "muscle-map", "negative",
                "reference", "cover")
MACHINE_EQUIPMENT = {"selectorized", "plate-loaded", "cable", "assisted", "smith"}
ANCHORS = {"sequence": "machine-chest-press/sequence", "side": "machine-chest-press/side",
           "machine": "machines/pec-deck", "muscle-map": "muscles/chest"}
SEQUENCE_ANCHOR_CAMERA = "three-quarter front"  # a sequence references the anchor only from the anchor's own camera
# A cable station drawn alone grows a seat and a back pad unless told otherwise (P2 review: 8 of 9 single columns).
FREE_STANDING_CABLE = ("Important: a free-standing cable station — the exercise is done standing or kneeling on the "
                       "floor beside it, so NO seat, NO bench, NO back pad and NO knee rollers are attached to it. ")
PRIORITY_MUSCLES, PRIORITY_COVER = 4, 9
RESERVE_FACTOR, RESERVE_PAD = 1.25, 0.005  # reservation = estimate x 1.25 + $0.005 (an upper bound in practice)
TIMEOUT = 360
RETRY_CODES = {408, 409, 429, 500, 502, 503, 504}
MIME = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
CWEBP = shutil.which("cwebp") or "/opt/homebrew/bin/cwebp"
DWEBP = shutil.which("dwebp") or "/opt/homebrew/bin/dwebp"
EQUIPMENT_TEXT = {
    "selectorized": "a pin-loaded (selectorized) machine with a weight stack and a selector pin",
    "plate-loaded": "a plate-loaded lever machine with weight plates on horns",
    "cable": "a cable column with an adjustable pulley and a weight stack",
    "barbell": "a barbell with plain plates",
    "dumbbell": "dumbbells",
    "bodyweight": "body weight only (plus the bench, bar or floor the setup names)",
    "assisted": "an assisted pull-up and dip machine with a knee pad linked to a weight stack",
    "smith": "a Smith machine (a barbell fixed on vertical guide rails)",
    "kettlebell": "a kettlebell",
    "band": "a resistance band",
}
ATTACHMENTS = {  # used only to warn when the catalog's setup names a different attachment than the scene
    "rope": r"\brope\b",
    "straight bar": r"\b(straight|short|long)( or ez)? bar\b",
    "V-handle": r"\bv-(handle|bar|grip)\b|\bdouble[- ]d\b",
    "stirrup handle": r"\bstirrup\b|\bsingle handle\b|\bd-handle\b",
    "EZ bar": r"\bez[- ]?(curl )?bar\b",
}
PRINT_LOCK = threading.Lock()


def say(*parts):
    with PRINT_LOCK:
        print(*parts, flush=True)


# ------------------------------------------------------------------------------------------------ files & helpers
def rel(path):
    path = Path(path)
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)


def load_json(path, default=None):
    if not path.exists():
        if default is not None:
            return default
        raise SystemExit(f"missing {rel(path)}")
    return json.loads(path.read_text())


def save_json(path, data, indent=1):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=indent, ensure_ascii=False) + "\n")
    tmp.replace(path)


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def sha(path, n=10):
    return hashlib.sha1(path.read_bytes()).hexdigest()[:n] if path.exists() else None


def clean(text):
    return (text or "").strip().rstrip(".").strip()


def redact(text):
    """Error bodies may echo part of the key; never let anything key-like reach the terminal or a log."""
    return re.sub(r"sk-[A-Za-z0-9_*\-]{4,}", "sk-[redacted]", text or "")


def style_blocks():
    """The ```prompt <name>``` blocks of STYLE.md and a short hash of the file (recorded in the manifest)."""
    text = STYLE_MD.read_text()
    blocks = {m.group(1): m.group(2).strip() for m in re.finditer(r"```prompt ([\w-]+)\n(.*?)\n```", text, re.S)}
    missing = [b for b in STYLE_BLOCKS if b not in blocks]
    if missing:
        raise SystemExit(f"STYLE.md lacks prompt blocks: {', '.join(missing)}")
    return blocks, hashlib.sha1(text.encode()).hexdigest()[:10]


def rates(pricing, model):
    try:
        return pricing["models"][model]
    except KeyError:
        raise SystemExit(f"{model} is not in pricing.json (models: {', '.join(pricing['models'])})") from None


def estimate(pricing, model, quality, size, prompt_chars, n_refs):
    """Per-image output price + prompt text tokens + reference image tokens, in USD."""
    m = rates(pricing, model)
    try:
        per_image = m["perImage"][quality][size]
    except KeyError:
        raise SystemExit(f"no price for {model} {quality} {size} in pricing.json") from None
    tok = m["perMillionTokens"]
    text_tokens = prompt_chars / 4 + 40
    ref_tokens = n_refs * m.get("inputTokensPerReferenceImage", 1536)
    return round(per_image + text_tokens * tok["textInput"] / 1e6 + ref_tokens * tok["imageInput"] / 1e6, 4)


def cost_from_usage(pricing, model, usage):
    """Actual cost from the response's usage block; None when the response has none."""
    if not usage:
        return None
    tok = rates(pricing, model)["perMillionTokens"]
    inp = usage.get("input_tokens_details") or {}
    out = usage.get("output_tokens_details") or {}
    text_in = inp.get("text_tokens", usage.get("input_tokens", 0) - inp.get("image_tokens", 0))
    image_in = inp.get("image_tokens", 0)
    image_out = out.get("image_tokens", usage.get("output_tokens", 0))
    text_out = out.get("text_tokens", 0)
    return round((text_in * tok["textInput"] + image_in * tok["imageInput"]
                  + (image_out + text_out) * tok["imageOutput"]) / 1e6, 4)


def load_spend():
    return load_json(SPEND, {"currency": "USD", "total": 0.0, "images": [], "updatedAt": None})


# ------------------------------------------------------------------------------------------------ catalog
def humanize(eid):
    return eid.replace("-", " ").capitalize()


def load_records():
    """One record per registry exercise (registry order): catalog data when content/fitness/exercises.json has it,
    else the scenes.json fallback. Returns (records, scenes, registry, source, catalog_sha)."""
    registry = load_json(REGISTRY)
    scenes = load_json(SCENES)
    catalog = load_json(EXERCISES, []) if EXERCISES.exists() else []
    rows = {e["id"]: e for e in catalog if isinstance(e, dict) and e.get("id")}
    unknown = sorted(set(rows) - set(registry["exercises"]))
    if unknown:
        print(f"warning: exercises.json ids not in the registry are ignored: {', '.join(unknown)}")
    records = []
    for order, (eid, reg) in enumerate(registry["exercises"].items()):
        sc = scenes["exercises"].get(eid, {})
        row = rows.get(eid, {})
        primary = row.get("primary") or sc.get("primary") or []
        records.append({
            "id": eid,
            "order": order,
            "name": clean((row.get("name") or {}).get("en")) or sc.get("name") or humanize(eid),
            "equipment": row.get("equipment") or sc.get("eq") or "bodyweight",
            "pattern": row.get("pattern") or reg["pattern"],
            "classes": reg.get("classes") or [reg.get("class")],
            "primary": primary,
            "secondary": (row.get("secondary") or []) if row.get("primary") else (sc.get("secondary") or []),
            # "one side at a time" is a drawing direction: a scene's explicit `uni` wins (the catalog marks the
            # Pallof press or the dead bug unilateral, but both hands hold one handle / both sides move)
            "unilateral": bool(sc["uni"]) if "uni" in sc else bool(row.get("unilateral", False)),
            "setup": clean((row.get("setup") or {}).get("en")),
            "cues": [clean(c) for c in ((row.get("cues") or {}).get("en") or [])[:4] if clean(c)],
            "tags": row.get("tags") or [],
            "alternatives": row.get("alternatives") or [],
            "scene": sc,
        })
    source = rel(EXERCISES) if rows else "registry.json + art/fitness/scenes.json (catalog still empty)"
    return records, scenes, registry, source, (sha(EXERCISES) if rows else None)


def priorities(records, registry, from_catalog):
    """1 = owner-primary, 2 = their alternatives, 3 = the rest; plus a rank that keeps the program order."""
    owner = [eid for day in registry["ownerTemplate"]["days"] for _, eid in day["slots"]]
    owner += [r["id"] for r in records if "owner-primary" in r["tags"] and r["id"] not in owner]
    primary = set(owner)
    by_id = {r["id"]: r for r in records}
    if from_catalog:
        alts = {a for eid in primary for a in by_id[eid]["alternatives"] if a in by_id}
    else:  # fallback: every member of the owner exercises' equivalence classes
        members = {c["id"]: c["members"] for c in registry["classes"]}
        alts = {m for eid in primary for c in by_id[eid]["classes"] for m in members.get(c, [])}
    alts -= primary
    prio = {r["id"]: 1 if r["id"] in primary else 2 if r["id"] in alts else 3 for r in records}
    rank = {r["id"]: owner.index(r["id"]) if r["id"] in primary else 1000 + r["order"] for r in records}
    return prio, rank


# ------------------------------------------------------------------------------------------------ scenes
def muscle_list(ids, scenes):
    return "; ".join(scenes["muscles"].get(m, m.replace("-", " ")) for m in ids)


def where(rec):
    sc = rec["scene"]
    if sc.get("machine"):
        return sc["machine"]
    # The drawing's own `eq` beats the catalog's filter value: the catalog files the plate neck exercises under
    # "plate-loaded", which drew a lever machine under a bench where the setup only holds a plate on a towel.
    eq = sc.get("eq") or rec["equipment"]
    return EQUIPMENT_TEXT.get(eq, eq)


def catalog_lines(rec):
    lines = []
    if rec["setup"]:
        lines.append(f"The exercise page describes the set-up as: {rec['setup']} (draw consistently with it).")
    if rec["cues"]:
        lines.append("Technique the drawing must respect (never write these as text): " + "; ".join(rec["cues"]) + ".")
    return lines


def muscle_lines(rec, scenes):
    lines = [f"Paint flat orange (working muscles): {muscle_list(rec['primary'], scenes) or 'the working muscles'}."]
    if rec["secondary"]:
        lines.append(f"Paint pale orange (assisting muscles): {muscle_list(rec['secondary'], scenes)}.")
    return lines


def sequence_scene(rec, scenes):
    sc, pat = rec["scene"], scenes["patterns"].get(rec["pattern"], {})
    camera = sc.get("camera") or pat.get("camera") or "three-quarter front"
    lines = [f"Exercise: {rec['name']}, done on {where(rec)}.",
             f"Camera: {scenes['cameras'].get(camera, camera)}; the same in both panels."]
    if sc.get("setup"):
        lines.append(f"Setup, the same in both panels: {sc['setup']}.")
    lines += catalog_lines(rec)
    path = sc.get("path") or pat.get("path", "along the movement")
    # `pair`: a symmetric movement gets STYLE.md's `sequence-pair` layout (build_prompt) and two mirrored arrows
    arrow = (f"The two mirrored orange arrows, in the LEFT panel: {path}; each tail starts where its moving part is in "
             "the START position and each triangular head points the way that part travels toward the END position, "
             "never back toward the START." if sc.get("pair") else
             f"The single orange arrow, in the LEFT panel: {path}; its tail starts where the moving part is in the START "
             "position and its triangular head points the way that part travels toward the END position, never back "
             "toward the START.")
    lines += [f"LEFT panel, START position: {sc.get('start') or pat.get('start', 'the starting position')}.",
              f"RIGHT panel, END position: {sc.get('end') or pat.get('end', 'the finished position')}.", arrow]
    for note in (sc.get("note"), sc.get("seqNote")):  # review corrections: `note` = sequence + side, `seqNote` = panels
        if note:
            lines.append(f"Important: {note}.")
    lines += muscle_lines(rec, scenes)
    if rec["unilateral"]:
        lines.append("Done one side at a time: the working arm or leg is the one nearest the camera; the other rests.")
    return camera, " ".join(lines)


def side_scene(rec, scenes):
    sc = rec["scene"]
    camera = sc.get("sideCamera") or scenes["cameras"]["pure side"]
    lines = [f"Exercise: {rec['name']}, done on {where(rec)}.", f"Camera: {camera}."]
    if sc.get("setup"):
        lines.append(f"Setup: {sc['setup']}.")
    lines += catalog_lines(rec)
    lines += [f"The one moment shown, the hardest point of the repetition: {sc.get('hard') or sc.get('start')}.",
              "The single orange arrow follows the lifting path through this moment: "
              f"{sc.get('sidePath') or sc.get('path', 'along the movement')}; its triangular head points the way the "
              "hands (or the moving body part) travel during the lift, never the way back — when this moment is the "
              "end of the lift, the arrow ends at the hands with its tail back where they came from."]
    for note in (sc.get("note"), sc.get("sideNote")):  # per-exercise corrections after a review
        if note:
            lines.append(f"Important: {note}.")
    lines += muscle_lines(rec, scenes)
    if rec["unilateral"]:
        lines.append("Done one side at a time: the working arm or leg is the one nearest the camera.")
    return (sc["sideCamera"].split(":")[0] if sc.get("sideCamera") else "pure side"), " ".join(lines)


def seated_station(rec):
    """True when the station text names a seat or bench, like the seated pec-deck anchor."""
    return bool(re.search(r"\b(seat|bench)\b", where(rec).lower()))


def machine_scene(rec):
    desc = where(rec)
    note = rec["scene"].get("machineNote")  # per-machine correction after a review
    free_standing = rec["equipment"] == "cable" and not seated_station(rec)
    return (f"{desc[0].upper()}{desc[1:]}, set up ready for the {rec['name'].lower()}. "
            + (f"Important: {note}. " if note else "")
            + (FREE_STANDING_CABLE if free_standing else "")
            + "The machine alone, empty: no person, no mannequin, no hands.")


def muscle_scene(group, muscles, scenes):
    regions = {m["region"] for m in muscles}
    views = ("the FRONT view" if regions == {"front"} else "the BACK view" if regions == {"back"}
             else "both the FRONT and the BACK view")
    return (f"Muscle group: {group['name']['en'].lower()}. Paint flat orange: "
            f"{'; '.join(scenes['muscles'].get(m['id'], m['name']['en']) for m in muscles)}. "
            f"These show on {views}; where one of them wraps around the body (the sides of the waist, the shoulders, "
            "the slope of the neck), paint it on every view where it is visible.")


def build_prompt(blocks, kind, scene, pair=False):
    if kind == "cover":
        return f"{blocks['cover']}\n\nScene: {scene}."
    parts = [blocks["base"]]
    if kind in ("sequence", "side", "muscle-map"):
        parts.append(blocks["mannequin"])
    layout = blocks["sequence-pair"] if kind == "sequence" and pair else blocks[kind]
    parts += [layout, f"Scene: {scene}", blocks["negative"]]
    return "\n\n".join(parts)


def attachment_warnings(records):
    out = []
    for rec in records:
        if not rec["setup"]:
            continue
        scene_text = " ".join(rec["scene"].get(k, "") for k in ("machine", "setup")).lower()
        said = {a for a, rx in ATTACHMENTS.items() if re.search(rx, rec["setup"].lower())}
        drawn = {a for a, rx in ATTACHMENTS.items() if re.search(rx, scene_text)}
        if said and drawn and not said & drawn:
            out.append(f"{rec['id']}: the catalog setup names {', '.join(sorted(said))}, the scene draws "
                       f"{', '.join(sorted(drawn))} — align art/fitness/scenes.json before generating")
    return out


# ------------------------------------------------------------------------------------------------ plan
def original_of(key):
    return COVER_ART if key == "cover" else f"art/fitness/originals/{key}.webp"


def planned_refs(kind, key, fresh=False):
    """Style references: the cover uses the two home covers; the sequence and side anchors start fresh (a
    two-panel or three-quarter reference pulls the profile view off its camera), and so does every picture whose
    composition the anchor would distort (`fresh`, decided in plan(): a sequence drawn from another camera than the
    anchor's, a side view with its own non-profile camera, a cable station or any station without a seat or bench —
    the seated pec-deck anchor adds seats — or a kind listed in the scene's `fresh`). The batch showed that fresh pictures keep the house style from the
    prompt alone, while a reference transfers its camera and machine layout. The machine and muscle-map anchors
    borrow the sequence anchor's line and palette; everything else references its own kind's anchor."""
    if kind == "cover":
        return list(COVER_REFS)
    if fresh or key in (ANCHORS["sequence"], ANCHORS["side"]):
        return []
    if key == ANCHORS.get(kind):
        return [original_of(ANCHORS["sequence"])]
    return [original_of(ANCHORS[kind])]


def make_entry(kind, key, out, scene, camera, priority, rank, blocks, pricing, model, quality, fresh=False, pair=False,
               **extra):
    prompt = build_prompt(blocks, kind, scene, pair)
    refs = planned_refs(kind, key, fresh)
    size = SIZES[kind]
    chars = len(prompt) + (len(blocks["reference"]) + 2 if refs else 0)
    return {"key": key, "kind": kind, **extra, "out": out, "size": size, "width": WIDTHS[kind], "quality": quality,
            "model": model, "priority": priority, "rank": rank, "camera": camera, "refs": refs,
            "cost": estimate(pricing, model, quality, size, chars, len(refs)), "scene": scene, "prompt": prompt}


def plan(args):
    blocks, style_sha = style_blocks()
    pricing = load_json(PRICING)
    records, scenes, registry, source, catalog_sha = load_records()
    model, quality = args.model, args.quality
    rates(pricing, model)
    prio, rank = priorities(records, registry, catalog_sha is not None)

    def mk(*a, **kw):
        return make_entry(*a, blocks=blocks, pricing=pricing, model=model, quality=quality, **kw)

    entries = []
    for rec in records:
        eid, p = rec["id"], prio[rec["id"]]
        fresh = set(rec["scene"].get("fresh") or [])  # kinds this exercise draws without a style reference
        camera, scene = sequence_scene(rec, scenes)
        entries.append(mk("sequence", f"{eid}/sequence", f"{MEDIA}/exercises/{eid}/sequence.webp", scene, camera,
                          p, rank[eid], fresh="sequence" in fresh or camera != SEQUENCE_ANCHOR_CAMERA,
                          pair=bool(rec["scene"].get("pair")), angle="sequence", exercise=eid))
        if p == 1:
            camera, scene = side_scene(rec, scenes)
            entries.append(mk("side", f"{eid}/side", f"{MEDIA}/exercises/{eid}/side.webp", scene, camera,
                              p, rank[eid], fresh="side" in fresh or bool(rec["scene"].get("sideCamera")),
                              angle="side", exercise=eid))
        station = rec["scene"].get("station")  # true adds a station picture; false drops one the equipment implies
        if station or (station is None and rec["equipment"] in MACHINE_EQUIPMENT):
            entries.append(mk("machine", f"machines/{eid}", f"{MEDIA}/machines/{eid}.webp", machine_scene(rec),
                              "three-quarter front", p, rank[eid],
                              fresh="machine" in fresh or rec["equipment"] == "cable" or not seated_station(rec),
                              angle="machine", exercise=eid))
    by_group = {}
    for m in registry["muscles"]:
        by_group.setdefault(m["group"], []).append(m)
    for g in registry["groups"]:
        entries.append(mk("muscle-map", f"muscles/{g['id']}", f"{MEDIA}/muscles/{g['id']}.webp",
                          muscle_scene(g, by_group.get(g["id"], []), scenes), "front and back",
                          PRIORITY_MUSCLES, g["order"], angle="muscle-map", group=g["id"]))
    entries.append(mk("cover", "cover", COVER_ART, clean(scenes["cover"]), "eye level", PRIORITY_COVER, 0,
                      angle="cover"))
    entries.sort(key=lambda e: (e["priority"], KIND_ORDER[e["kind"]], e["rank"], e["key"]))
    manifest = {"generatedAt": now(), "source": source, "catalogSha1": catalog_sha, "styleSha1": style_sha,
                "scenesSha1": sha(SCENES), "model": model, "quality": quality,
                "referenceNote": blocks["reference"], "count": len(entries),
                "estimatedCost": round(sum(e["cost"] for e in entries), 2), "anchors": ANCHORS, "entries": entries}
    save_json(MANIFEST, manifest)
    print(f"wrote {rel(MANIFEST)} from {source}: {len(entries)} pictures, ≈ ${manifest['estimatedCost']:.2f} "
          f"at {quality} ({model})")
    for kind in KINDS:
        group = [e for e in entries if e["kind"] == kind]
        tiers = ", ".join(f"p{p}: {sum(1 for e in group if e['priority'] == p)}"
                          for p in sorted({e["priority"] for e in group}))
        cost = {q: sum(estimate(pricing, model, q, e["size"],
                                len(e["prompt"]) + (len(blocks["reference"]) + 2 if e["refs"] else 0), len(e["refs"]))
                       for e in group)
                for q in rates(pricing, model)["qualities"]}
        print(f"  {kind:10s} {len(group):3d}  ({tiers})  " + "  ".join(f"{q} ${c:6.2f}" for q, c in cost.items()))
    for warning in attachment_warnings(records):
        print(f"warning: {warning}")


# ------------------------------------------------------------------------------------------------ API
class ApiError(Exception):
    pass


class Refused(ApiError):
    """The safety system declined the prompt: logged and skipped, never retried blindly."""


class Uncertain(ApiError):
    """The request was sent but no answer arrived (timeout, reset): it may have been billed."""


def _headers(content_type):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit("OPENAI_API_KEY is not set")
    return {"Authorization": f"Bearer {key}", "Content-Type": content_type}


def _post(url, body, headers):
    delay = 10
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = redact(e.read().decode(errors="replace"))
            if e.code in RETRY_CODES and attempt < 3:
                say(f"    HTTP {e.code}, retrying in {delay} s")
                time.sleep(delay)
                delay *= 2
                continue
            low = msg.lower()
            if e.code == 400 and any(k in low for k in ("moderation", "content_policy", "safety system", "violat")):
                raise Refused(f"HTTP {e.code}: {msg[:400]}") from e
            raise ApiError(f"HTTP {e.code}: {msg[:600]}") from e
        except urllib.error.URLError as e:  # not sent (DNS, refused) unless the reason is a timeout
            if isinstance(e.reason, TimeoutError):
                raise Uncertain(f"timeout: {e.reason}") from e
            if attempt < 3:
                say(f"    network error ({e.reason}), retrying in {delay} s")
                time.sleep(delay)
                delay *= 2
                continue
            raise ApiError(f"network: {e.reason}") from e
        except (TimeoutError, ConnectionError, http.client.HTTPException) as e:
            raise Uncertain(f"{e.__class__.__name__}: {e}") from e
    raise ApiError("retries exhausted")


def generate(prompt, model, quality, size):
    body = json.dumps({"model": model, "prompt": prompt, "size": size, "quality": quality,
                       "output_format": "webp", "n": 1}).encode()
    return _post(f"{API}/generations", body, _headers("application/json"))


def edit(prompt, refs, model, quality, size):
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in (("model", model), ("prompt", prompt), ("size", size), ("quality", quality),
                        ("output_format", "webp"), ("n", "1")):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    for ref in refs:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="{ref.name}"\r\n'
                     f'Content-Type: {MIME[ref.suffix.lower()]}\r\n\r\n'.encode() + ref.read_bytes() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return _post(f"{API}/edits", b"".join(parts), _headers(f"multipart/form-data; boundary={boundary}"))


# ------------------------------------------------------------------------------------------------ output files
def webp_resize(src, dst, width):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if Path(CWEBP).exists():
        subprocess.run([CWEBP, "-quiet", "-q", "80", "-m", "6", "-resize", str(width), "0", str(src), "-o", str(dst)],
                       check=True)
        return
    from PIL import Image  # fallback when libwebp is not installed
    im = Image.open(src).convert("RGB")
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=80, method=6)


def share_jpeg(src, dst, width=1200, height=630, quality=82):
    """Centre-cropped link-preview JPEG, like sync-content.sh's share() for the other covers."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image
    except ImportError:
        png = dst.with_suffix(".tmp.png")
        subprocess.run([DWEBP, "-quiet", str(src), "-o", str(png)], check=True)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(quality), "--resampleWidth",
                        str(width), str(png), "--out", str(dst)], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["sips", "-c", str(height), str(width), str(dst)], check=True, stdout=subprocess.DEVNULL)
        png.unlink(missing_ok=True)
        return
    im = Image.open(src).convert("RGB")
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    top = max(0, (im.height - height) // 2)
    im.crop((0, top, width, top + height)).save(dst, "JPEG", quality=quality, optimize=True, progressive=True)


def keep_previous(path, key):
    """A replaced original is kept for comparison under originals/_previous/ (gitignored)."""
    if path.exists():
        dest = ORIGINALS / "_previous" / f"{key.replace('/', '__')}.{time.strftime('%Y%m%d-%H%M%S')}{path.suffix}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, dest)


def deliver(entry, data):
    """Save the original, then the optimized copies the site serves."""
    original = ROOT / original_of(entry["key"])
    keep_previous(original, entry["key"])
    original.parent.mkdir(parents=True, exist_ok=True)
    original.write_bytes(data)
    if entry["kind"] == "cover":
        webp_resize(original, COVER_PUBLIC, WIDTHS["cover"])
        share_jpeg(original, COVER_SHARE)
        return [original, COVER_PUBLIC, COVER_SHARE]
    out = ROOT / entry["out"]
    webp_resize(original, out, entry.get("width", WIDTHS[entry["kind"]]))
    return [original, out]


def write_index():
    try:
        subprocess.run(["node", str(INDEX_SCRIPT)], check=True, cwd=ROOT)
    except (OSError, subprocess.CalledProcessError) as e:
        say(f"warning: could not rewrite content/fitness/images.json ({e}); run `node {rel(INDEX_SCRIPT)}`")


# ------------------------------------------------------------------------------------------------ run
class Ledger:
    """spend.json plus in-flight reservations, behind one lock: total + reserved never passes the budget."""

    def __init__(self, budget):
        self.budget = budget
        self.lock = threading.Lock()
        self.spend = load_spend()
        self.reserved = 0.0

    def total(self):
        with self.lock:
            return self.spend["total"]

    def reserve(self, amount):
        with self.lock:
            if self.spend["total"] + self.reserved + amount > self.budget + 1e-9:
                return False
            self.reserved += amount
            return True

    def release(self, amount):
        with self.lock:
            self.reserved = max(0.0, self.reserved - amount)

    def charge(self, reserved, record):
        with self.lock:
            self.reserved = max(0.0, self.reserved - reserved)
            self.spend["total"] = round(self.spend["total"] + record["cost"], 4)
            self.spend["images"].append(record)
            self.spend["updatedAt"] = now()
            save_json(SPEND, self.spend)
            return self.spend["total"]


def log_prompt(lock, key, entry):
    with lock:
        log = load_json(PROMPT_LOG, {})
        log.setdefault(key, []).append(entry)
        save_json(PROMPT_LOG, log)


def select(entries, args):
    keys = {e["key"] for e in entries}
    only = None
    if args.only:
        only = set()
        for item in (s.strip() for s in args.only.split(",")):
            if not item:
                continue
            matched = {k for k in keys if k == item or k in (f"{item}/sequence", f"{item}/side", f"machines/{item}")}
            if not matched:
                raise SystemExit(f"--only: no manifest entry matches {item}")
            only |= matched
    angles = {a.strip() for a in (args.angle or "").split(",") if a.strip()} or None
    if angles and angles - set(KINDS):
        raise SystemExit(f"--angle takes {', '.join(KINDS)}")
    return [e for e in entries
            if (args.priority is None or e["priority"] <= args.priority)
            and (angles is None or e["kind"] in angles)
            and (only is None or e["key"] in only)]


def resolve_refs(entry, args):
    if args.no_ref:
        return []
    if args.ref:
        refs = [Path(r).resolve() for r in args.ref]
        missing = [str(r) for r in refs if not r.exists()]
        if missing:
            raise SystemExit(f"--ref not found: {', '.join(missing)}")
        return refs
    planned = entry.get("refs", [])
    refs = [ROOT / r for r in planned if (ROOT / r).exists() and r != original_of(entry["key"])]
    if planned and not refs and entry["kind"] in ("sequence", "machine", "muscle-map"):
        anchor = ROOT / original_of(ANCHORS["sequence"])  # the kind's own anchor is missing: borrow the sequence one
        refs = [anchor] if anchor.exists() and entry["key"] != ANCHORS["sequence"] else []
    return refs


class RunLock:
    """One run at a time, so two processes cannot both spend against the same remaining budget."""

    def __enter__(self):
        ART.mkdir(parents=True, exist_ok=True)
        for _ in range(2):
            try:
                fd = os.open(RUN_LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                return self
            except FileExistsError:
                pid = RUN_LOCK.read_text().strip()
                try:
                    os.kill(int(pid), 0)
                except (ValueError, ProcessLookupError):
                    RUN_LOCK.unlink(missing_ok=True)  # stale lock from a dead run
                    continue
                except PermissionError:
                    pass
                raise SystemExit(f"another run (pid {pid}) is generating pictures; wait for it or delete {rel(RUN_LOCK)}") from None
        raise SystemExit(f"could not take {rel(RUN_LOCK)}")

    def __exit__(self, *exc):
        RUN_LOCK.unlink(missing_ok=True)


def check_manifest(manifest, style_sha, args):
    problems = []
    if manifest.get("styleSha1") != style_sha:
        problems.append("STYLE.md changed since the manifest was written")
    if manifest.get("scenesSha1") != sha(SCENES):
        problems.append("art/fitness/scenes.json changed since the manifest was written")
    catalog = load_json(EXERCISES, []) if EXERCISES.exists() else []
    if (sha(EXERCISES) if catalog else None) != manifest.get("catalogSha1"):
        problems.append("content/fitness/exercises.json changed since the manifest was written")
    if problems:
        message = "; ".join(problems) + " — run `python3 scripts/fitness-images.py plan` first"
        if not args.dry_run:
            raise SystemExit(message)
        print(f"note: {message}")


def run(args):
    blocks, style_sha = style_blocks()
    pricing = load_json(PRICING)
    if not MANIFEST.exists():
        raise SystemExit("no manifest: run `plan` first")
    manifest = load_json(MANIFEST)
    check_manifest(manifest, style_sha, args)
    model = args.model or manifest.get("model", DEFAULT_MODEL)
    rates(pricing, model)
    if args.workers < 1:
        raise SystemExit("--workers must be at least 1")
    if not args.dry_run and not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is not set")
    entries = select(manifest["entries"], args)
    todo = [e for e in entries if args.force or not (ROOT / e["out"]).exists()]
    anchor_order = list(ANCHORS.values())
    first = sorted((e for e in todo if e["key"] in anchor_order), key=lambda e: anchor_order.index(e["key"]))
    rest = [e for e in todo if e["key"] not in anchor_order]
    if args.dry_run:
        dry_run(args, blocks, pricing, model, entries, todo, first + rest)
        return
    with RunLock():  # the spend snapshot is read under the lock, so a run that just finished is counted
        execute(args, blocks, pricing, model, manifest, style_sha, entries, todo, first, rest)


def dry_run(args, blocks, pricing, model, entries, todo, ordered):
    """What a run would make and cost, settling each picture at its estimate (like one worker); writes nothing."""
    total = load_spend()["total"]
    print(f"spend so far ${total:.2f} of ${args.budget_usd:.2f}; {len(entries)} selected, "
          f"{len(entries) - len(todo)} already made, {len(todo)} to make — DRY RUN, nothing is generated or written")
    planned = 0.0
    for e in ordered:
        quality = args.quality or e["quality"]
        n_refs = 0 if args.no_ref else len(args.ref or []) or len(e["refs"])
        chars = len(e["prompt"]) + (len(blocks["reference"]) + 2 if n_refs else 0)
        est = estimate(pricing, model, quality, e["size"], chars, n_refs)
        if total + planned + est * RESERVE_FACTOR + RESERVE_PAD > args.budget_usd + 1e-9:
            print(f"budget: {e['key']} (≈ ${est:.3f}) could pass ${args.budget_usd:.2f} — a real run stops at or "
                  "before this picture")
            break
        planned += est
        print(f"  would make {e['key']:44s} {quality:6s} {e['size']} refs={n_refs}  ≈ ${est:.3f}  → {e['out']}")
    print(f"dry run: ≈ ${planned:.2f} planned; the total would be ≈ ${total + planned:.2f} of ${args.budget_usd:.2f}")


def execute(args, blocks, pricing, model, manifest, style_sha, entries, todo, first, rest):
    ledger = Ledger(args.budget_usd)
    print(f"spend so far ${ledger.total():.2f} of ${args.budget_usd:.2f}; {len(entries)} selected, "
          f"{len(entries) - len(todo)} already made, {len(todo)} to make", flush=True)
    log_lock = threading.Lock()
    stop = threading.Event()
    counts = {"made": 0, "refused": 0, "uncertain": 0, "errors": 0, "over": 0}
    count_lock = threading.Lock()

    def count(what):
        with count_lock:
            counts[what] += 1

    def make(e):
        if stop.is_set():
            return
        quality = args.quality or e["quality"]
        refs = resolve_refs(e, args)
        prompt = f"{blocks['reference']}\n\n{e['prompt']}" if refs else e["prompt"]
        est = estimate(pricing, model, quality, e["size"], len(prompt), len(refs))
        reserve = round(est * RESERVE_FACTOR + RESERVE_PAD, 4)
        if not ledger.reserve(reserve):
            if not stop.is_set():
                say(f"budget: {e['key']} (≈ ${est:.3f}) could take the total past ${args.budget_usd:.2f} "
                    f"(spent ${ledger.total():.2f} plus requests in flight) — stopping")
            count("over")
            stop.set()
            return
        entry = {"model": model, "size": e["size"], "quality": quality, "refs": [rel(r) for r in refs],
                 "out": e["out"], "styleSha1": style_sha, "scenesSha1": manifest.get("scenesSha1"),
                 "estimatedCost": est, "prompt": prompt, "created": now()}
        t0 = time.time()
        try:
            res = edit(prompt, refs, model, quality, e["size"]) if refs else generate(prompt, model, quality, e["size"])
            data = base64.b64decode(res["data"][0]["b64_json"])
        except Refused as x:
            ledger.release(reserve)
            count("refused")
            log_prompt(log_lock, e["key"], {**entry, "status": "refused", "error": str(x)})
            say(f"  refused   {e['key']}: {x}")
            return
        except Uncertain as x:  # may have been billed: charge the estimate, never retry blindly
            count("uncertain")
            total = ledger.charge(reserve, {"key": e["key"], "kind": e["kind"], "model": model, "quality": quality,
                                            "size": e["size"], "refs": len(refs), "usage": None, "cost": est,
                                            "estimated": est, "status": "uncertain", "at": now(), "out": e["out"]})
            log_prompt(log_lock, e["key"], {**entry, "status": "uncertain", "cost": est, "error": str(x)})
            say(f"  uncertain {e['key']}: {x} — charged the estimate ${est:.3f} (total ${total:.2f})")
            return
        except (ApiError, KeyError, IndexError, ValueError) as x:
            ledger.release(reserve)
            count("errors")
            log_prompt(log_lock, e["key"], {**entry, "status": "error", "error": redact(str(x))})
            say(f"  error     {e['key']}: {redact(str(x))} — no new requests will start")
            stop.set()
            return
        usage = res.get("usage")
        cost = cost_from_usage(pricing, model, usage)
        cost = est if cost is None else cost
        if cost > reserve:
            say(f"  note: {e['key']} cost ${cost:.4f}, above its reservation ${reserve:.4f}")
        total = ledger.charge(reserve, {"key": e["key"], "kind": e["kind"], "model": model, "quality": quality,
                                        "size": e["size"], "refs": len(refs), "usage": usage, "cost": cost,
                                        "estimated": est, "status": "ok", "at": now(), "out": e["out"]})
        outputs, failure = [], None
        try:
            outputs = deliver(e, data)
        except (OSError, subprocess.CalledProcessError) as x:  # paid for: keep the record, stop the batch
            failure = f"{x.__class__.__name__}: {x}"
        seconds = round(time.time() - t0)
        log_prompt(log_lock, e["key"], {**entry, "status": "ok", "cost": cost, "usage": usage, "seconds": seconds,
                                        "outputs": [rel(p) for p in outputs],
                                        **({"deliveryError": failure} if failure else {})})
        if failure:
            count("errors")
            say(f"  saved?    {e['key']}: paid ${cost:.4f} but writing the files failed ({failure}) — stopping")
            stop.set()
            return
        count("made")
        say(f"  made      {e['key']:44s} ${cost:.4f}  {seconds:3d} s  refs={len(refs)}  total ${total:.2f}")

    try:
        for e in first:  # anchors alone, so every later picture can reference them
            make(e)
        if rest and not stop.is_set():
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures = [pool.submit(make, e) for e in rest]
                try:
                    for future in futures:
                        future.result()
                except KeyboardInterrupt:
                    stop.set()
                    for future in futures:
                        future.cancel()
                    raise
    except KeyboardInterrupt:
        stop.set()
        say("interrupted: requests in flight were finished and recorded; nothing new was started")
    finally:
        write_index()
    spent = ledger.total()
    print(f"done: {counts['made']} made, {counts['refused']} refused, {counts['uncertain']} uncertain, "
          f"{counts['errors']} errors; spent ${spent:.2f} of ${args.budget_usd:.2f}, "
          f"${max(0.0, args.budget_usd - spent):.2f} left")
    if counts["errors"] or counts["over"]:
        sys.exit(1)


# ------------------------------------------------------------------------------------------------ status
def status(args):
    spend = load_spend()
    budget = args.budget_usd
    ok = [i for i in spend["images"] if i.get("status", "ok") == "ok"]
    print(f"spend: ${spend['total']:.2f} of ${budget:.2f} ({len(ok)} pictures, {len(spend['images']) - len(ok)} "
          f"uncertain); remaining ${max(0.0, budget - spend['total']):.2f}"
          + (f"; last {spend['updatedAt']}" if spend.get("updatedAt") else ""))
    if spend["images"]:
        by_kind = {}
        for i in ok:
            by_kind.setdefault(i.get("kind") or i["key"].split("/")[-1], []).append(i["cost"])
        print("  average cost: " + ", ".join(f"{k} ${sum(v) / len(v):.4f} ({len(v)})" for k, v in sorted(by_kind.items())))
    if not MANIFEST.exists():
        print("no manifest yet — run `plan`")
        return
    manifest = load_json(MANIFEST)
    entries = manifest["entries"]
    print(f"manifest: {len(entries)} pictures from {manifest.get('source')} at {manifest.get('quality')} "
          f"({manifest.get('model')}), written {manifest.get('generatedAt')}")
    for kind in KINDS:
        group = [e for e in entries if e["kind"] == kind]
        if group:
            done = sum(1 for e in group if (ROOT / e["out"]).exists())
            todo = sum(e["cost"] for e in group if not (ROOT / e["out"]).exists())
            print(f"  {kind:10s} {done:3d} / {len(group):<3d} made; remaining ≈ ${todo:.2f}")
    for p in sorted({e["priority"] for e in entries}):
        group = [e for e in entries if e["priority"] == p]
        done = sum(1 for e in group if (ROOT / e["out"]).exists())
        todo = sum(e["cost"] for e in group if not (ROOT / e["out"]).exists())
        print(f"  priority {p}: {done:3d} / {len(group):<3d} made; remaining ≈ ${todo:.2f}")
    refused = [k for k, hist in load_json(PROMPT_LOG, {}).items() if hist and hist[-1].get("status") == "refused"]
    if refused:
        print(f"  refused last time: {', '.join(refused)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="command", required=True)
    p = sub.add_parser("plan", help="write art/fitness/manifest.json from the catalog (or the registry fallback)")
    p.add_argument("--quality", default="medium", choices=["low", "medium", "high"])
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.set_defaults(func=plan)
    r = sub.add_parser("run", help="generate the missing pictures within the budget")
    r.add_argument("--budget-usd", type=float, default=DEFAULT_BUDGET, help="cumulative cap over spend.json")
    r.add_argument("--quality", choices=["low", "medium", "high"], help="override the manifest's quality")
    r.add_argument("--model", help="override the manifest's model (must be in pricing.json)")
    r.add_argument("--priority", type=int, help="only entries with priority <= N")
    r.add_argument("--angle", "--kind", dest="angle", help="comma-separated: " + ",".join(KINDS))
    r.add_argument("--only", help="comma-separated keys (lat-pulldown/side, machines/pec-deck) or exercise ids")
    r.add_argument("--workers", type=int, default=3, help="parallel requests (default 3)")
    r.add_argument("--dry-run", action="store_true", help="print what would be made and the cost; no API calls")
    r.add_argument("--force", action="store_true", help="regenerate even if the output exists")
    r.add_argument("--no-ref", action="store_true", help="no style reference images")
    r.add_argument("--ref", action="append", help="explicit style reference image (repeatable)")
    r.set_defaults(func=run)
    s = sub.add_parser("status", help="counts, spend so far, remaining budget")
    s.add_argument("--budget-usd", type=float, default=DEFAULT_BUDGET)
    s.set_defaults(func=status)
    i = sub.add_parser("index", help="rewrite content/fitness/images.json from public/media/fitness")
    i.set_defaults(func=lambda _: write_index())
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
