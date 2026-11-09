"""Every fitness page answers, renders without errors and never scrolls sideways on a small phone, in both languages."""
import pytest
from playwright.sync_api import expect

from conftest import no_horizontal_scroll, owner_exercises, science_topics

STATIC = ["/fitness", "/fitness/train", "/fitness/program", "/fitness/profile", "/fitness/exercises", "/fitness/gyms",
          "/fitness/progress", "/fitness/nutrition", "/fitness/science", "/fitness/tools"]
PAGES = STATIC + [f"/fitness/exercises/{i}" for i in owner_exercises()] + [f"/fitness/science/{t}" for t in science_topics()]


@pytest.mark.parametrize("lang", ["en", "ru"])
@pytest.mark.parametrize("path", PAGES)
def test_page_renders_on_a_small_phone(small_phone, base_url, lang, path):
    page, probe = small_phone
    url = base_url + (path if lang == "en" else f"/ru{path}")
    response = page.goto(url, wait_until="networkidle")
    assert response is not None and response.status == 200, f"{url} → {response.status if response else 'no response'}"
    page.wait_for_timeout(300)
    assert page.locator("h1").count() >= 1, "every page has a heading"
    assert page.evaluate("() => document.documentElement.lang") == lang
    no_horizontal_scroll(page)
    probe.assert_clean()


@pytest.mark.parametrize("path", ["/fitness", "/fitness/exercises/machine-chest-press", "/fitness/progress"])
def test_page_renders_on_desktop(desktop_page, base_url, path):
    page, probe = desktop_page
    response = page.goto(base_url + path, wait_until="networkidle")
    assert response is not None and response.status == 200
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_fitness_is_in_the_site_navigation(phone, base_url):
    page, probe = phone
    page.goto(base_url + "/", wait_until="networkidle")
    link = page.locator("header nav a[href='/fitness']")
    assert link.count() == 1
    assert page.locator("a.tile[href='/fitness']").count() == 1, "the home page has a Fitness tile"
    probe.assert_clean()


@pytest.mark.parametrize("lang", ["en", "ru"])
def test_fitness_section_menu_supports_keyboard_and_navigation(small_phone, base_url, lang):
    page, probe = small_phone
    prefix = "" if lang == "en" else "/ru"
    page.goto(base_url + prefix + "/fitness", wait_until="networkidle")
    nav = page.locator(".fit-nav")
    summary = nav.locator("summary")
    summary.focus()
    page.keyboard.press("Enter")
    expect(nav.locator("details")).to_have_attribute("open", "")
    for path in ["profile", "progress", "exercises", "gyms", "nutrition", "tools", "science"]:
        expect(nav.locator(f"a[href='{prefix}/fitness/{path}']")).to_be_visible()
    no_horizontal_scroll(page)
    page.keyboard.press("Escape")
    expect(nav.locator("details")).not_to_have_attribute("open", "")
    expect(summary).to_be_focused()
    summary.click()
    page.locator("h1").click()
    expect(nav.locator("details")).not_to_have_attribute("open", "")
    summary.click()
    nav.locator(f"a[href='{prefix}/fitness/progress']").click()
    expect(page).to_have_url(base_url + prefix + "/fitness/progress")
    expect(page.locator(".fit-nav summary")).to_have_class("is-current")
    expect(page.locator(".fit-nav summary")).to_contain_text("Progress" if lang == "en" else "Прогресс")
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_exercise_page_shows_alternatives_and_muscles(phone, base_url):
    page, probe = phone
    page.goto(base_url + "/fitness/exercises/pec-deck", wait_until="networkidle")
    assert page.locator("svg [data-muscle]").count() > 10, "muscle map paths are present"
    assert page.locator("a[href^='/fitness/exercises/']").count() >= 3, "alternatives link to their pages"
    probe.assert_clean()


# Where a 360 px phone could still split a quantity on the nutrition page (keepUnits, src/lib/fitness/i18n.ts): a plain
# space before a unit, an en dash between digits with no word joiner after it, a Russian unit's slash with none
# ("0,4 г/" | "кг" broke in Blink and WebKit), a plain space after "≈" or "±". "уд/мин" may carry its joiner already.
UNITS = r"kcal|bpm|METs?|mg|kg|km|ml|cm|min|g|l|L|h|s|m|W|%|tbsp|cups?|ккал|уд/\u2060?мин|МЕТ|мг|кг|км|мл|см|мин|Вт|г|л|ч|м|тыс\.|ст\.[ \u00a0]лож(?:ка|ки|ек)|чаш(?:ка|ки|ек|ку)|стакан(?:а|ов)?"
LOOSE = {
    "plain space before a unit": r"\d (?:" + UNITS + r")(?![\p{L}\p{M}\d])",
    "range dash without a word joiner": r"\d–\d",
    "Russian unit slash without a word joiner": r"(?:^|[^\p{L}\p{M}])(?:ккал|уд|МЕТ|мг|кг|км|мл|см|мин|Вт|г|л|ч|м|%)/\p{L}",
    "plain space after ≈ or ±": r"[≈±] \d",
    "tablespoon measure can split": r"ст\. лож(?:ка|ки|ек)(?![\p{L}\p{M}\d])",
}
# The text of `main` the way a line sees it: joined across inline elements (React renders {a}–{b} as three text nodes),
# split at blocks, table cells, inline-blocks and <br>. Matched in the page, as Python's re has no \p{L}.
LOOSE_QUANTITIES = """(patterns) => {
  const runs = [];
  let run = "";
  const end = () => { if (run.trim()) runs.push(run); run = ""; };
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) run += child.data;
      else if (child.nodeType === Node.ELEMENT_NODE) {
        const display = getComputedStyle(child).display;
        const flows = (display === "inline" || display === "contents") && child.tagName !== "BR";
        if (!flows) end();
        walk(child);
        if (!flows) end();
      }
    }
  };
  walk(document.querySelector("main"));
  end();
  const hits = [];
  for (const [kind, source] of Object.entries(patterns))
    for (const text of runs)
      for (const m of text.matchAll(new RegExp(source, "gu")))
        hits.push(`${kind}: …${text.slice(Math.max(0, m.index - 24), m.index + m[0].length + 24)}…`);
  const all = runs.join("\\n");
  return { runs: runs.length, dashes: all.split("–\\u2060").length - 1, slashes: all.split("/\\u2060").length - 1, hits };
}"""


def tap_until(button, opened, tries=10):
    """Tap `button` until `opened(timeout_ms)` (an expect) passes. A tap that lands before hydration does nothing, and
    nothing on the page says when hydration is done, so tap again rather than check the default state. React applies a
    click within the event, so a second of nothing means the tap was lost, and the next one cannot close it again."""
    for _ in range(tries - 1):
        button.click()
        try:
            opened(1_000)
            return
        except AssertionError:
            pass
    button.click()
    opened(5_000)


@pytest.mark.parametrize("lang", ["en", "ru"])
def test_nutrition_keeps_quantities_whole_on_a_small_phone(small_phone, base_url, lang):
    page, _ = small_phone
    page.goto(base_url + ("/fitness/nutrition" if lang == "en" else "/ru/fitness/nutrition"), wait_until="networkidle")
    page.wait_for_timeout(300)
    more = page.locator("button.nut-more")  # every food, not only the top 15
    tap_until(more, lambda ms: expect(more).to_have_attribute("aria-expanded", "true", timeout=ms))
    detail = page.locator(".nut-food-detail")  # one food's details: macros, serving, source
    tap_until(page.locator(".nut-foods tbody th button").first, lambda ms: expect(detail).to_have_count(1, timeout=ms))
    found = page.evaluate(LOOSE_QUANTITIES, LOOSE)
    assert found["runs"] > 200, f"only {found['runs']} runs of text: did the page render?"
    assert not found["hits"], f"{len(found['hits'])} quantities can break:\n" + "\n".join(found["hits"])
    assert found["dashes"] >= 10 and found["slashes"] >= 3, f"keepUnits did not run: {found['dashes']} ranges, {found['slashes']} slashes joined"
