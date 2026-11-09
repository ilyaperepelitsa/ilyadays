"""Food discovery and cooking still work through the sitewide presentation changes."""
import os
import json
from pathlib import Path
import re

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("SITE_E2E_BASE", "http://localhost:3001")


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as pw:
        instance = pw.chromium.launch()
        yield instance
        instance.close()


@pytest.fixture
def page(browser):
    context = browser.new_context(viewport={"width": 360, "height": 800}, is_mobile=True, has_touch=True)
    context.route("**/_vercel/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=""))
    instance = context.new_page()
    errors = []
    instance.on("pageerror", lambda error: errors.append(str(error)))
    yield instance
    assert not errors, errors
    assert context.cookies() == []
    width = instance.evaluate("() => [document.documentElement.scrollWidth,document.documentElement.clientWidth]")
    assert width[0] <= width[1] + 1, width
    context.close()


@pytest.mark.parametrize("lang", ["en", "ru"])
def test_search_is_immediate_and_query_and_ingredient_filters_survive_reload(page, lang):
    prefix = "" if lang == "en" else "/ru"
    page.goto(BASE + prefix + "/food", wait_until="networkidle")
    search = page.get_by_role("searchbox")
    expect(search).to_be_visible()
    recent = page.locator(".recent .card").first
    assert recent.locator(".card-text").bounding_box()["width"] <= recent.bounding_box()["width"], "recent recipe text must fit its card"
    query = "onigiri" if lang == "en" else "онигири"
    search.fill(query)
    expect(page).to_have_url(re.compile(r"[?&]q="))
    expect(page.locator(".card").first).to_be_visible()
    page.reload(wait_until="networkidle")
    expect(search).to_have_value(query)
    toggle = page.locator("button[aria-controls='ingredient-search-panel']")
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")
    ingredient = page.locator(".ingredient-bubbles button").first
    ingredient.click()
    expect(ingredient).to_have_attribute("aria-pressed", "true")
    expect(page).to_have_url(re.compile(r"[?&]ing="))
    page.reload(wait_until="networkidle")
    expect(toggle).to_have_attribute("aria-expanded", "true")
    expect(page.locator(".ingredient-bubbles button[aria-pressed='true']")).to_have_count(1)
    page.locator(".ingredient-bubbles button[aria-pressed='true']").click()
    search.fill("zz-no-such-dish-98765")
    expect(page.locator(".card")).to_have_count(0)
    search.fill("")
    expect(page.locator(".card").first).to_be_visible()


@pytest.mark.parametrize("lang", ["en", "ru"])
def test_recipe_scaling_and_cooking_checkmarks_survive_reload(page, lang):
    prefix = "" if lang == "en" else "/ru"
    page.goto(BASE + prefix + "/food/oyakodon", wait_until="networkidle")
    portions = page.locator(".portions input[data-n]")
    initial = float(portions.input_value())
    amount = page.locator(".ingredients .ing-amt").first
    before = amount.inner_text()
    page.locator(".portions button[data-step='1']").click()
    expect(portions).to_have_value(str(int(initial + 1)))
    expect(amount).not_to_have_text(before)
    ingredient = page.locator(".ingredients li").first
    ingredient.locator(".ing-name").click()
    expect(ingredient).to_have_class(re.compile(r"\bdone\b"))
    step = page.locator("li.step").first
    step.locator("h3").click()
    expect(step).to_have_class(re.compile(r"\bdone\b"))
    page.reload(wait_until="networkidle")
    expect(portions).to_have_value(str(int(initial + 1)))
    expect(ingredient).to_have_class(re.compile(r"\bdone\b"))
    expect(step).to_have_class(re.compile(r"\bdone\b"))


@pytest.mark.parametrize("path,section", [("/", None), ("/food", "/food"), ("/travel", "/travel"), ("/fitness", "/fitness")])
def test_shared_header_identifies_one_current_section(page, path, section):
    page.goto(BASE + path, wait_until="networkidle")
    expect(page.locator("header .brand")).to_have_attribute("href", "/")
    active = page.locator(".site-primary-nav [aria-current='page']")
    expect(active).to_have_count(0 if section is None else 1)
    if section:
        expect(active).to_have_attribute("href", section)
    if path == "/travel":
        action = page.locator(".travel-create-action")
        expect(action).to_have_attribute("href", "/travel/new")
        assert action.bounding_box()["y"] < 500


@pytest.mark.parametrize("lang", ["en", "ru"])
def test_offline_help_is_optional_and_does_not_start_a_download(page, lang):
    prefix = "" if lang == "en" else "/ru"
    page.goto(BASE + prefix + "/food", wait_until="networkidle")
    footer = page.locator(".site-footer")
    footer.scroll_into_view_if_needed()
    save = footer.locator(".offline-actions button")
    expect(save).to_be_visible()
    expect(footer.locator(".offline-size")).to_contain_text(re.compile(r"\d"))
    help_box = footer.locator(".offline-help")
    expect(help_box).not_to_have_attribute("open", "")
    registrations = page.evaluate("async () => (await navigator.serviceWorker.getRegistrations()).length")
    help_box.locator("summary").focus()
    page.keyboard.press("Enter")
    expect(help_box).to_have_attribute("open", "")
    expect(help_box.locator("p").last).to_be_visible()
    assert page.evaluate("async () => (await navigator.serviceWorker.getRegistrations()).length") == registrations
    expect(save).to_be_enabled()
    help_box.locator("summary").click()
    expect(help_box).not_to_have_attribute("open", "")


ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize('lang', ['en', 'ru'])
def test_all_sous_vide_rows_match_the_source_in_each_filter_and_view(page, lang):
    prefix = '' if lang == 'en' else '/ru'
    tables = json.loads((ROOT / 'content' / lang / 'sous-vide.json').read_text())['tables']
    page.goto(BASE + prefix + '/food/sous-vide#reference', wait_until='networkidle')
    reference = page.locator('#reference')
    expect(reference).to_have_attribute('open', '')
    expect(reference.locator('input[name=sv-layout][value=table]')).to_be_checked()
    first = reference.locator('.cooking-reference-frame').first
    first.scroll_into_view_if_needed()
    first.focus()
    pinned = first.locator('thead th').first.bounding_box()['x']
    page.keyboard.press('ArrowRight')
    page.wait_for_function("() => document.querySelector('.cooking-reference-frame').scrollLeft > 0")
    assert abs(first.locator('thead th').first.bounding_box()['x'] - pinned) < 2, 'identifying column stays pinned'
    for layout in ['cards', 'table']:
        reference.locator(f'input[name=sv-layout][value={layout}]').check()
        expect(reference).to_have_attribute('data-layout', layout)
        if layout == 'cards':
            assert reference.locator('.cooking-state').evaluate_all("badges => badges.every(el => el.getBoundingClientRect().right <= el.closest('tr').getBoundingClientRect().right + 1)"), 'state labels fit within their cards'
        for state in ['all', 'frozen', 'chilled']:
            reference.locator(f'input[name=sv-state][value={state}]').check()
            actual = reference.locator('.sv-table-section').evaluate_all("""sections => Object.fromEntries(sections.map(section => [section.id,
                [...section.querySelectorAll('tbody tr[data-starting-state]')].map(row => [...row.cells].map(cell => cell.textContent.trim()))]))""")
            for table in tables:
                expected = [row for i, row in enumerate(table['rows']) if state == 'all' or table['states'][i] in [state, 'both']]
                assert actual[table['id']] == expected, (lang, table['id'], state, layout)
    assert reference.locator('.cook-reference-table').first.evaluate("table => getComputedStyle(table).display") == 'table'


@pytest.mark.parametrize('lang', ['en', 'ru'])
def test_recipe_table_quantities_still_follow_servings_and_unit_controls(page, lang):
    prefix = '' if lang == 'en' else '/ru'
    page.goto(BASE + prefix + '/food/cucumber-sunomono', wait_until='networkidle')
    frame = page.locator('.cooking-table-frame')
    expect(frame).to_have_count(1)
    frame.scroll_into_view_if_needed()
    expect(frame).to_have_attribute('tabindex', '0')
    assert frame.evaluate('el => el.scrollWidth > el.clientWidth'), 'wide comparison scrolls inside its frame'
    amount = frame.locator('tbody .q[data-k="mass"]').first
    original = amount.inner_text()
    ingredient = page.locator('.ingredients .ing-amt .q').first
    ingredient_original = ingredient.inner_text()
    portions = page.locator('.portions')
    portions.locator('button[data-step="1"]').click()
    expect(ingredient).not_to_have_text(ingredient_original)
    expect(amount).to_have_text(original)  # fixed reference ratios do not scale with servings
    metric = amount.inner_text()
    portions.locator('button[data-units=us]').click()
    expect(amount).not_to_have_text(metric)
    expect(frame.locator('thead th.cooking-number')).to_have_count(3)
    assert frame.locator('tbody tr').count() >= 3
