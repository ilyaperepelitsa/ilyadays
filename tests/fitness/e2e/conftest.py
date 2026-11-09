"""Shared fixtures for the fitness browser tests. Run through scripts/fitness-e2e.sh (it starts the server).

Every test gets a fresh browser context (empty localStorage = a phone that has never opened the site) at phone size
with touch, unless it asks for `desktop_page`. `fake_backend` intercepts the Supabase REST calls the page makes, so a
test can play "fitness tables missing" (today's production), "owner's public log" (visitor view) or "no signal",
whatever the build's .env.local points at.
"""
import json
import os
import re
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
BASE = os.environ.get("FITNESS_E2E_BASE", "http://localhost:3130")
OWNER_ID = "00000000-0000-4000-8000-00000000f17e"


def owner_exercises():
    data = json.loads((ROOT / "content/fitness/exercises.json").read_text())
    return [e["id"] for e in data if "owner-primary" in e.get("tags", [])]


def science_topics():
    folder = ROOT / "content/fitness/science"
    return sorted(p.name[: -len(".en.md")] for p in folder.glob("*.en.md")) if folder.exists() else []


@pytest.fixture(scope="session")
def base_url():
    return BASE


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        yield b
        b.close()


class PageProbe:
    """Collects what went wrong on a page: uncaught errors, console errors, failed same-origin requests.

    Chrome reports every failed fetch as a console error ("Failed to load resource"); failures of other origins
    (the Supabase API answering 404 because the fitness tables are missing) are expected and ignored.
    """

    def __init__(self, page):
        self.page = page
        self.errors, self.console, self.failed = [], [], []
        page.on("pageerror", lambda e: self.errors.append(str(e)))
        page.on("console", self._console)
        page.on("response", lambda r: self.failed.append(f"{r.status} {r.url}") if r.status >= 400 and r.url.startswith(BASE) else None)

    def _console(self, msg):
        if msg.type != "error":
            return
        where = (msg.location or {}).get("url", "")
        if msg.text.startswith("Failed to load resource") and not where.startswith(BASE):
            return
        self.console.append(f"{msg.text} @ {where}")

    def assert_clean(self):
        assert not self.errors, f"page errors: {self.errors}"
        assert not self.failed, f"failed requests: {self.failed}"
        noisy = [c for c in self.console if "Download the React DevTools" not in c]
        assert not noisy, f"console errors: {noisy}"


def _context(browser, width, height, mobile):
    ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2 if mobile else 1,
                              is_mobile=mobile, has_touch=mobile, locale="en-GB", timezone_id="Europe/Istanbul")
    # Vercel Analytics / Speed Insights scripts exist only on Vercel; `next start` answers 404 (and Chrome logs a MIME
    # error), which would fail every probe. Serve them empty, as a stand-in for Vercel.
    ctx.route(f"{BASE}/_vercel/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
    return ctx


@pytest.fixture
def phone(browser):
    ctx = _context(browser, 390, 844, True)
    page = ctx.new_page()
    probe = PageProbe(page)
    yield page, probe
    ctx.close()


@pytest.fixture
def small_phone(browser):
    ctx = _context(browser, 360, 780, True)
    page = ctx.new_page()
    probe = PageProbe(page)
    yield page, probe
    ctx.close()


@pytest.fixture
def desktop_page(browser):
    ctx = _context(browser, 1280, 860, False)
    page = ctx.new_page()
    probe = PageProbe(page)
    yield page, probe
    ctx.close()


class FakeBackend:
    """Answers the page's Supabase REST calls (`/rest/v1/...`) from Python.

    state = "missing": every fitness rpc/table answers 404 PGRST202/PGRST205 (production today).
    state = "public":  the fitness schema exists; fitness_owner_id returns OWNER_ID and table reads return `rows`.
    state = "down":    every Supabase request fails at the network level (no signal in the gym).
    Writes are recorded in `writes` and answered 201 (a viewer must never produce any).
    Only effective when the build has NEXT_PUBLIC_SUPABASE_URL set; otherwise the store is local ("unconfigured").
    """

    def __init__(self, page):
        self.page, self.state, self.rows, self.writes, self.calls = page, "missing", {}, [], []
        page.context.route(re.compile(r".*/rest/v1/.*"), self._handle)
        page.context.route(re.compile(r".*/realtime/v1/.*"), lambda route: route.abort())
        # HTTP routes do not see WebSockets: answer the realtime socket here and close it, so a viewer-mode page never
        # reaches the real project named in .env.local (Playwright >= 1.48).
        self.sockets = []
        page.context.route_web_socket(re.compile(r".*/realtime/v1/.*"), self._socket)

    def _socket(self, ws):
        self.sockets.append(ws.url)
        ws.close(code=1000, reason="fake backend: no realtime")

    def _handle(self, route):
        req = route.request
        url = req.url
        self.calls.append(f"{req.method} {url}")
        if self.state == "down":
            return route.abort("internetdisconnected")
        table = re.search(r"/rest/v1/(?:rpc/)?([a-z_]+)", url)
        name = table.group(1) if table else ""
        if self.state == "missing":
            code = "PGRST202" if "/rpc/" in url else "PGRST205"
            return route.fulfill(status=404, content_type="application/json",
                                 body=json.dumps({"code": code, "message": f"Could not find {name} in the schema cache", "details": None, "hint": None}))
        if req.method in ("POST", "PATCH", "DELETE") and "/rpc/" not in url:
            self.writes.append(f"{req.method} {url}")
            return route.fulfill(status=201, content_type="application/json", body="[]")
        if name == "fitness_owner_id":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(OWNER_ID))
        if name in ("fitness_can_write", "is_admin"):
            return route.fulfill(status=200, content_type="application/json", body="false")
        rows = self.rows.get(name, [])
        single = "application/vnd.pgrst.object" in (req.headers.get("accept") or "")
        body = json.dumps((rows[0] if rows else None) if single else rows)
        headers = {"content-range": f"0-{max(len(rows) - 1, 0)}/{len(rows)}" if rows else "*/0"}
        return route.fulfill(status=200, content_type="application/json", headers=headers, body=body)


@pytest.fixture
def fake_backend(phone):
    page, _ = phone
    return FakeBackend(page)


def no_horizontal_scroll(page):
    width = page.evaluate("() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]")
    assert width[0] <= width[1] + 1, f"page scrolls sideways: scrollWidth {width[0]} > {width[1]}"
