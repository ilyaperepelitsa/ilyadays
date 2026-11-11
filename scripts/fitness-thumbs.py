#!/usr/bin/env python3
"""Square thumbnails of the fitness exercises, shown at 40-72 px (plan rows, the exercise list).

  public/media/fitness/exercises/<id>/sequence.webp  ->  public/media/fitness/thumbs/exercises/<id>/sequence.webp

(Under public/media/fitness, which `npm run sync` keeps; it wipes public/media/thumbs for the recipe cards.)

A technique picture is two panels, START | END, 1200x800. Both at once are unreadable at 48 px, so a thumb shows
ONE panel, cropped to its subject:

  1. find the divider (the darkest column near the middle) and take the panel left of it (START) or right of it (END);
  2. the subject is every pixel far from the picture's own background colour (median of the panel corners; the
     ivory drifts between pictures). The soft ground shadow is closer to the background than the threshold, so it
     does not widen the box;
  3. add a 6% margin and grow the box to a square around its centre: the whole subject;
  4. zoom in on the worked part: the highlighted muscles and the motion arrow are the only saturated orange, and
     the crop is a square 1.9x their extent, centred on them, but never less than 66% of the whole subject. So a
     person inside a tall frame fills the thumb and the far end of the frame is left out. A side that would lose
     only a sliver of the subject (under 14%: a scalp, the feet) is kept whole instead;
  5. whatever falls outside the panel is filled with the fixed ivory #faf6ef. The picture's own background is
     shifted to that ivory too, so the fill never shows as a rectangle and all thumbs share one ground;
  6. save 216x216 WebP (3x a 72 px list thumb).

Only `sequence` gets a thumb: nothing shows the single-panel side views small.

art/fitness/thumbs.json:

  {
    "recipe": 2,       # written from RECIPE below; bump RECIPE to remake every thumb after changing the crop rule
    "overrides": {     # optional, per exercise id; edit by hand, then rerun (only the changed ones are remade)
      "plank": { "panel": "end" },        # crop the END panel instead of START ("start" is the default)
      "wrist-curl": { "whole": true },    # skip step 4: show the whole subject (when the zoom cuts a head off)
      "pull-up": { "zoom": 1.45 },        # step 4 with this factor instead of 1.9, without the 66% floor and the
                                          # sliver rule: a tighter crop for a small person in a big station
      "some-id": { "box": [40, 120, 420, 500] }   # explicit crop in source pixels [left, top, right, bottom], inside
                                          # one panel; squared up, no margin; the other keys are then ignored.
                                          # Pixels go stale when the picture is redrawn: prefer the keys above.
    },
    "thumbs": { "<id>": { "v": "<picture version>", "key": "<recipe + override hash>" } }
  }

The page requests the thumb with the ORIGINAL picture's `?v=` (content/fitness/images.json), so `v` records which
version each thumb was made from and `key` which recipe and override; tests/fitness/thumbs.test.mjs fails when a
picture changed and its thumb was not remade. Up-to-date thumbs are skipped, so a rerun is cheap.

  python scripts/fitness-thumbs.py              # make missing or outdated thumbs, delete orphans
  python scripts/fitness-thumbs.py --check      # exit 1 when anything is missing or outdated
  python scripts/fitness-thumbs.py --box <id>   # print the automatic box of both panels (a start for an override)

Run after scripts/fitness-images.py and before node scripts/fitness-image-index.mjs.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/media/fitness/exercises"
DST = ROOT / "public/media/fitness/thumbs/exercises"
MANIFEST = ROOT / "art/fitness/thumbs.json"
ANGLE = "sequence"
RECIPE = 2
SIZE = 216
IVORY = (250, 246, 239)  # #faf6ef
SUBJECT = 40  # a pixel this far (largest channel difference) from the background is subject; the shadow is ~20
MARGIN = 0.06
ZOOM = 1.9  # the crop is this many times the worked muscles (with the arrow)...
MIN_PART = 0.66  # ...but never less than this part of the whole subject
SLIVER = 0.14  # never trim less than this part of the subject off a side: keep that side whole instead
GUTTER = 8  # px dropped on each side of the divider


def version(path: Path) -> str:
    """Same 8-hex SHA-1 prefix scripts/fitness-image-index.mjs writes as `v`."""
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def recipe_key(override) -> str:
    blob = json.dumps([RECIPE, SIZE, IVORY, SUBJECT, MARGIN, ZOOM, MIN_PART, SLIVER, override or {}], sort_keys=True)
    return hashlib.sha1(blob.encode()).hexdigest()[:8]


def divider(im) -> int:
    """x of the line between the panels: the darkest column in the middle tenth, else the centre.

    Read from the top and bottom strips only, where the line is alone (a machine post is as dark, lower down)."""
    from PIL import Image

    w, h = im.size
    lo, hi, strip = round(w * 0.45), round(w * 0.55), 24
    ends = Image.new("L", (hi - lo, 2 * strip))
    ends.paste(im.crop((lo, 0, hi, strip)).convert("L"), (0, 0))
    ends.paste(im.crop((lo, h - strip, hi, h)).convert("L"), (0, strip))
    cols = ends.resize((hi - lo, 1), Image.BOX).tobytes()
    x = min(range(len(cols)), key=cols.__getitem__)
    return lo + x if cols[x] < 190 else w // 2


def panels(im):
    """(left, top, right, bottom) of the START and END panels."""
    w, h = im.size
    x = divider(im)
    return {"start": (0, 0, x - GUTTER, h), "end": (x + GUTTER + 1, 0, w, h)}


def background(im, panel):
    """The picture's own ivory: per-channel median of four patches in the panel's corners."""
    from PIL import Image

    l, t, r, b = panel
    p, s = 6, 14
    spots = [(l + p, t + p), (r - p - s, t + p), (l + p, b - p - s), (r - p - s, b - p - s)]
    means = [im.crop((x, y, x + s, y + s)).resize((1, 1), Image.BOX).getpixel((0, 0)) for x, y in spots]
    return tuple(round(sum(sorted(m[c] for m in means)[1:3]) / 2) for c in range(3))


def distance(im, bg):
    """Largest channel difference from the background, as an L image."""
    from PIL import Image, ImageChops

    r, g, b = ImageChops.difference(im, Image.new("RGB", im.size, bg)).split()
    return ImageChops.lighter(ImageChops.lighter(r, g), b)


def subject_box(im, panel, bg):
    """Bounding box (source pixels) of the subject in a panel; rows and columns need 3+ subject pixels (no specks)."""
    from PIL import Image

    crop = im.crop(panel)
    w, h = crop.size
    mask = distance(crop, bg).point(lambda v: 255 if v > SUBJECT else 0)
    cols = [v * h / 255 >= 3 for v in mask.resize((w, 1), Image.BOX).tobytes()]
    rows = [v * w / 255 >= 3 for v in mask.resize((1, h), Image.BOX).tobytes()]
    if not any(cols) or not any(rows):
        return panel
    x0, x1 = cols.index(True), w - cols[::-1].index(True)
    y0, y1 = rows.index(True), h - rows[::-1].index(True)
    return (panel[0] + x0, panel[1] + y0, panel[0] + x1, panel[1] + y1)


def muscle_box(im, panel):
    """Bounding box of the highlighted muscles and the motion arrow (the only saturated orange), or None."""
    from PIL import Image, ImageChops

    crop = im.crop(panel)
    w, h = crop.size
    r, _, b = crop.split()
    mask = ImageChops.subtract(r, b).point(lambda v: 255 if v > 80 else 0)
    cols = [v * h / 255 >= 3 for v in mask.resize((w, 1), Image.BOX).tobytes()]
    rows = [v * w / 255 >= 3 for v in mask.resize((1, h), Image.BOX).tobytes()]
    if not any(cols) or not any(rows):
        return None
    x0, x1 = cols.index(True), w - cols[::-1].index(True)
    y0, y1 = rows.index(True), h - rows[::-1].index(True)
    return (panel[0] + x0, panel[1] + y0, panel[0] + x1, panel[1] + y1)


def focus(subject, muscles, zoom=None):
    """A square around the worked muscles, inside the subject's square: big frames lose their far ends.

    A side that would lose only a sliver of the subject (a scalp, the feet) is kept whole instead."""
    l, t, r, b = square(subject, MARGIN)
    full = r - l
    if not muscles:
        return (l, t, r, b)
    reach = max(muscles[2] - muscles[0], muscles[3] - muscles[1])
    side = min(full, zoom * reach if zoom else max(ZOOM * reach, MIN_PART * full))

    def span(m0, m1, s0, s1, lo, hi, length):
        a = min(max((m0 + m1 - length) / 2, lo), hi - length)
        z = a + length
        if zoom:
            return a, z
        if 0 < a - s0 < SLIVER * full:
            a = s0 - MARGIN * full / 2
        if 0 < s1 - z < SLIVER * full:
            z = s1 + MARGIN * full / 2
        return a, z

    xs = span(muscles[0], muscles[2], subject[0], subject[2], l, r, side)
    ys = span(muscles[1], muscles[3], subject[1], subject[3], t, b, side)
    side = round(min(full, max(xs[1] - xs[0], ys[1] - ys[0])))
    # grow the shorter span to the square: away from an edge that was snapped to the subject, else evenly
    def place(a, z, lo, hi):
        extra = side - (z - a)
        a = a - extra / 2
        return round(min(max(a, lo), hi - side))

    x, y = place(*xs, l, r), place(*ys, t, b)
    return (x, y, x + side, y + side)


def square(box, margin):
    l, t, r, b = box
    side = max(r - l, b - t) * (1 + 2 * margin)
    cx, cy = (l + r) / 2, (t + b) / 2
    x, y = round(cx - side / 2), round(cy - side / 2)
    return (x, y, x + round(side), y + round(side))


def render(im, override):
    """The 216 px thumb of one picture."""
    from PIL import Image

    both = panels(im)
    if override and override.get("box"):
        box = tuple(override["box"])
        mid = (box[0] + box[2]) / 2
        panel = both["start"] if mid < both["start"][2] else both["end"]
        if box[0] < panel[0] or box[2] > panel[2] or box[1] < 0 or box[3] > panel[3]:
            raise ValueError(f"box {list(box)} is not inside one panel {list(panel)}")
        bg = background(im, panel)
        sq = square(box, 0)
    else:
        override = override or {}
        panel = both[override.get("panel", "start")]
        bg = background(im, panel)
        sq = focus(subject_box(im, panel, bg), None if override.get("whole") else muscle_box(im, panel), override.get("zoom"))
    # the visible part of the square, with the picture's ivory moved to the fixed one
    l, t, r, b = max(sq[0], panel[0]), max(sq[1], panel[1]), min(sq[2], panel[2]), min(sq[3], panel[3])
    part = im.crop((l, t, r, b))
    near = distance(part, bg).point(lambda v: 0 if v <= 5 else 255 if v >= 13 else round((v - 5) * 255 / 8))
    shifted = Image.merge("RGB", [ch.point(lambda v, d=IVORY[i] - bg[i]: max(0, min(255, v + d))) for i, ch in enumerate(part.split())])
    flat = Image.new("RGB", part.size, IVORY)
    canvas = Image.new("RGB", (sq[2] - sq[0], sq[3] - sq[1]), IVORY)
    canvas.paste(Image.composite(shifted, flat, near), (l - sq[0], t - sq[1]))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def read_manifest():
    data = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    if "thumbs" not in data:  # the first shape: { "<id>/<angle>.webp": "<v>" }
        data = {}
    return data.get("overrides", {}), data.get("thumbs", {})


def main() -> int:
    args = sys.argv[1:]
    check = "--check" in args
    overrides, thumbs = read_manifest()
    if "--box" in args:
        from PIL import Image

        for eid in args[args.index("--box") + 1:]:
            with Image.open(SRC / eid / f"{ANGLE}.webp") as im:
                im = im.convert("RGB")
                for name, panel in panels(im).items():
                    subject, muscles = subject_box(im, panel, background(im, panel)), muscle_box(im, panel)
                    print(eid, name, "panel", list(panel), "subject", list(subject), "muscles", list(muscles or []), "crop", list(focus(subject, muscles)))
        return 0
    sources = {p.parent.name: p for p in sorted(SRC.glob(f"*/{ANGLE}.webp"))}
    unknown = sorted(set(overrides) - set(sources))
    wanted, made, problems = {}, 0, [f"override for an exercise without a picture: {eid}" for eid in unknown]
    for eid, src in sources.items():
        stamp = {"v": version(src), "key": recipe_key(overrides.get(eid))}
        wanted[eid] = stamp
        dst = DST / eid / f"{ANGLE}.webp"
        if dst.exists() and thumbs.get(eid) == stamp:
            continue
        if check:
            problems.append(f"outdated or missing thumb: {eid}")
            continue
        from PIL import Image  # only needed when something is (re)made

        with Image.open(src) as im:
            thumb = render(im.convert("RGB"), overrides.get(eid))
        dst.parent.mkdir(parents=True, exist_ok=True)
        thumb.save(dst, "WEBP", quality=82, method=6)
        made += 1
    keep = {DST / eid / f"{ANGLE}.webp" for eid in wanted}
    orphans = [p for p in DST.glob("*/*.webp") if p not in keep] if DST.exists() else []
    if check:
        problems += [f"orphan thumb: {p.relative_to(DST).as_posix()}" for p in orphans]
        print("\n".join(problems) if problems else f"thumbs: {len(wanted)} up to date")
        return 1 if problems else 0
    if unknown:
        print("\n".join(problems))
        return 1
    for p in orphans:
        p.unlink()
        if not any(p.parent.iterdir()):
            p.parent.rmdir()
    MANIFEST.write_text(json.dumps({"recipe": RECIPE, "overrides": dict(sorted(overrides.items())), "thumbs": dict(sorted(wanted.items()))}, indent=1) + "\n")
    total = sum(p.stat().st_size for p in keep)
    print(f"thumbs: {len(wanted)} total, {made} made, {len(orphans)} orphans removed, {total / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
