#!/usr/bin/env python3
"""Cover pictures for the ilyadays.com home page, in the recipe site's "clean" look.
Prompts are kept in src/covers/prompts.json. Existing covers are skipped; pass --force to redo.

    OPENAI_API_KEY=... python3 src/make_covers.py [--force] [food|travel ...]
"""
import base64, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "recipes" / "imagegen"))
import generate as G  # noqa: E402
import prompts as P   # noqa: E402

OUT = Path(__file__).resolve().parent / "covers"
STYLE = P.STYLES["clean"]["style"]
COVERS = {
    "food": "A cosy overhead spread on a smooth light-wood table: a dark lacquered donburi of oyakodon with silky "
            "egg, a white bowl of creamy ramen with spiral chashu slices, a soft egg and nori, a plate of tamagoyaki "
            "slices, a small dish of pink pickled red radish halves. Warm, appetising, minimal scenery.",
    "travel": "Istanbul at golden hour seen from the Galata Bridge: the domes and slender minarets of the old city "
              "on the hill across the Golden Horn, a white ferry crossing the calm water, a few gulls, soft warm "
              "light. Minimal, clean, no crowds, no text.",
}

def main():
    force = "--force" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    log = {}
    for name, scene in COVERS.items():
        dest = OUT / f"{name}.webp"
        prompt = f"{STYLE} {P.NO_TEXT}\n\n{P.RULES}\n\nScene: {scene}\n\n{P.SMALL_PIECES}"
        log[name] = prompt
        if (dest.exists() and not force) or (only and name not in only):
            continue
        res = G.generate(prompt, "medium")
        dest.write_bytes(base64.b64decode(res["data"][0]["b64_json"]))
        print(dest)
    (OUT / "prompts.json").write_text(json.dumps(log, indent=1, ensure_ascii=False))

if __name__ == "__main__":
    main()
