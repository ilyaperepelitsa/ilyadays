"""Food discovery and cooking still work through the sitewide presentation changes."""
import os
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
