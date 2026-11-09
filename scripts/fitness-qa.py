#!/usr/bin/env python3
"""Browser sweep of every fitness page: console errors, page errors, failed requests, horizontal overflow, tiny
tap targets, and full-page screenshots — at phone widths first, in English and Russian, light and dark.

    # with `npx next start -p 3123` running (after `npm run build`):
    /Users/ilyaperepelitsa/miniforge3/bin/python scripts/fitness-qa.py --base http://localhost:3123 --out output/fitness-qa

Needs Python Playwright with Chromium (`pip install playwright && playwright install chromium`). Writes
<out>/report.json and one PNG per page × viewport × scheme. Exit code 1 when any page has errors or overflow.
The Supabase API is answered here as a project without the fitness migration answers it (404, not in the schema
cache), so a slow or unreachable project cannot stall a page; `--live-backend` calls the configured project instead.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = {"phone360": (360, 780), "phone390": (390, 844), "phone430": (430, 932), "desktop": (1280, 860)}
STATIC = ["/fitness", "/fitness/train", "/fitness/program", "/fitness/exercises", "/fitness/gyms",
          "/fitness/progress", "/fitness/nutrition", "/fitness/science", "/fitness/tools"]

TAP_CHECK = """() => {
  const small = [];
  for (const el of document.querySelectorAll('main button, main a, main input, main select, main [role=button]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    if (el.closest('.fit-article, .sources, .fit-sources, p, li, td')) continue;  // inline text links are fine
    if (r.height < 40 || r.width < 40) small.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.value || el.ariaLabel || '').trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return small.slice(0, 15);
}"""
OVERFLOW = """() => {
  const w = document.documentElement.clientWidth;
  const wide = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.right > w + 1 && getComputedStyle(el).position !== 'fixed') {
      let p = el.parentElement, clipped = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } p = p.parentElement; }
      if (!clipped) wide.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(r.right)}`);
    }
  }
  return { scrollWidth: document.documentElement.scrollWidth, clientWidth: w, wide: wide.slice(0, 10) };
}"""


def expected_noise(msg, base: str) -> bool:
    """Console lines that are expected outside Vercel or with today's backend, not page problems:
    the Vercel-only /_vercel/ analytics scripts (404 and MIME errors under `next start`), and any failed request to
    another origin (the Supabase API answers 404 while the fitness tables are missing; the store handles it)."""
    where = (msg.location or {}).get("url", "") or ""
    if "/_vercel/" in msg.text or "/_vercel/" in where:
        return True
    return msg.text.startswith("Failed to load resource") and bool(where) and not where.startswith(base)


def stub_backend(ctx) -> None:
    """Answer every Supabase API call like a project without the fitness tables: 404 PGRST202 for functions, PGRST205
    for tables. That is what visitors get today, and the store then shows the browser-only mode."""
    def answer(route):
        code = "PGRST202" if "/rest/v1/rpc/" in route.request.url else "PGRST205"
        body = {"code": code, "message": "Not found in the schema cache (fitness-qa stub)", "details": None, "hint": None}
        route.fulfill(status=404, content_type="application/json", body=json.dumps(body))
    ctx.route(re.compile(r"^https?://[^/]+/(rest|auth|realtime)/v1/"), answer)


def routes(sample_exercises: int):
    paths = list(STATIC)
    try:
        exercises = json.loads((ROOT / "content/fitness/exercises.json").read_text())
    except Exception:
        exercises = []
    owner = [e["id"] for e in exercises if "owner-primary" in e.get("tags", [])]
    others = [e["id"] for e in exercises if "owner-primary" not in e.get("tags", [])]
    paths += [f"/fitness/exercises/{i}" for i in owner + others[:sample_exercises]]
    science = ROOT / "content/fitness/science"
    if science.exists():
        paths += sorted(f"/fitness/science/{p.name[:-6]}" for p in science.glob("*.en.md"))
    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--base", default="http://localhost:3123")
    ap.add_argument("--out", default=str(ROOT / "output/fitness-qa"))
    ap.add_argument("--only", help="regex on the path")
    ap.add_argument("--langs", default="en,ru")
    ap.add_argument("--viewports", default="phone360,phone390,phone430,desktop")
    ap.add_argument("--dark", action="store_true", help="also dark mode at phone390")
    ap.add_argument("--sample-exercises", type=int, default=6, help="non-owner exercise pages to include")
    ap.add_argument("--live-backend", action="store_true", help="call the configured Supabase project instead of the stub")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    report, bad = [], 0
    paths = [p for p in routes(a.sample_exercises) if not a.only or re.search(a.only, p)]
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for lang in a.langs.split(","):
            for path in paths:
                url_path = path if lang == "en" else f"/ru{path}"
                combos = [(v, "light") for v in a.viewports.split(",")]
                if a.dark:
                    combos.append(("phone390", "dark"))
                for vp, scheme in combos:
                    w, h = VIEWPORTS[vp]
                    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if vp != "desktop" else 1,
                                              color_scheme=scheme, is_mobile=vp != "desktop", has_touch=vp != "desktop")
                    if not a.live_backend:
                        stub_backend(ctx)
                    page = ctx.new_page()
                    console, errors, failed = [], [], []
                    page.on("console", lambda m, base=a.base: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") and not expected_noise(m, base) else None)
                    page.on("pageerror", lambda e: errors.append(str(e)))
                    page.on("requestfailed", lambda r, base=a.base: failed.append(f"{r.url} {r.failure}") if r.url.startswith(base) and "/_vercel/" not in r.url else None)
                    page.on("response", lambda r, base=a.base: failed.append(f"{r.status} {r.url}") if r.status >= 400 and r.url.startswith(base) and "/_vercel/" not in r.url else None)
                    try:
                        resp = page.goto(a.base + url_path, wait_until="networkidle", timeout=45000)
                        status = resp.status if resp else 0
                    except Exception as e:  # noqa: BLE001
                        status, errors = 0, errors + [f"navigation: {e}"]
                    page.wait_for_timeout(600)
                    ov = page.evaluate(OVERFLOW) if status else {"scrollWidth": 0, "clientWidth": 0, "wide": []}
                    taps = page.evaluate(TAP_CHECK) if status and vp != "desktop" else []
                    name = f"{lang}{path.replace('/', '_')}-{vp}-{scheme}.png"
                    try:
                        page.screenshot(path=str(out / name), full_page=True)
                    except Exception as e:  # noqa: BLE001
                        errors.append(f"screenshot: {e}")
                    overflow = ov["scrollWidth"] > ov["clientWidth"] + 1
                    real_console = [c for c in console if "Download the React DevTools" not in c]
                    entry = {"path": url_path, "viewport": vp, "scheme": scheme, "status": status, "screenshot": name,
                             "pageErrors": errors, "console": real_console[:20], "failedRequests": failed[:20],
                             "overflow": overflow, "overflowDetail": ov["wide"] if overflow else [], "smallTapTargets": taps}
                    problem = status != 200 or errors or overflow or any(c.startswith("error") for c in real_console) or failed
                    bad += bool(problem)
                    report.append(entry)
                    print(("FAIL " if problem else "ok   ") + f"{url_path} {vp} {scheme} {status}" +
                          (f" errors={len(errors)}" if errors else "") + (" OVERFLOW" if overflow else "") +
                          (f" console={len(real_console)}" if real_console else "") + (f" failed={len(failed)}" if failed else "") +
                          (f" small-taps={len(taps)}" if taps else ""))
                    ctx.close()
        browser.close()
    (out / "report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))
    print(f"{len(report)} page views, {bad} with problems → {out / 'report.json'}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
