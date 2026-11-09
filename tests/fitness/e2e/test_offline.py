"""No signal at all in the gym, without "Save on this phone": a phone that has logged here keeps the gym pages.

GymOffline (src/components/fitness/GymOffline.tsx) registers public/sw.js on a training phone and warms the gym copy;
the worker answers fitness pages from it when the network does not. The browser context goes fully offline here
(no network for pages either), unlike test_no_signal_keeps_logging, where only Supabase is down.
"""
import os

import pytest
from playwright.sync_api import expect

from test_gym_session import LOGGED, block_realtime, log_current, open_train, row_at, start_session, stored_sets, tid

pytestmark = pytest.mark.skipif(bool(os.environ.get("FITNESS_E2E_DEV")), reason="the gym copy is production-only (no service worker under next dev)")

GYM_COPY_READY = """async (paths) => {
  if (!('caches' in self) || !navigator.serviceWorker || !navigator.serviceWorker.controller) return false;
  const cache = await caches.open('gym-runtime-v1');
  for (const p of paths) if (!(await cache.match(p))) return false;
  return true;
}"""


def test_gym_pages_open_with_no_signal_after_logging_here(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    open_train(page, base_url, "A")
    session_id = start_session(page)
    first = log_current(page)

    # The phone now trains: the worker takes over and keeps the gym pages (hub, log, program, the program's exercises).
    page.wait_for_function(GYM_COPY_READY, arg=["/fitness", "/fitness/train", "/fitness/program", "/fitness/exercises/machine-chest-press"], timeout=90_000)

    page.context.set_offline(True)
    try:
        page.reload()
        expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
        expect(tid(page, "session")).to_have_attribute("data-session-id", session_id)
        expect(row_at(page, first["slot"], first["kind"], first["index"])).to_have_attribute("data-state", "done")
        second = log_current(page)
        assert (second["slot"], second["index"]) != (first["slot"], first["index"])
        expect(page.locator(LOGGED)).to_have_count(2)

        # Following the sub-navigation and an exercise link works with no network at all.
        page.goto(base_url + "/fitness")
        expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
        page.goto(base_url + "/fitness/exercises/machine-chest-press")
        expect(page.locator("h1")).to_have_count(1)
        page.goto(base_url + "/fitness/train")
        expect(tid(page, "session")).to_have_attribute("data-session-id", session_id)
        assert len(stored_sets(page, session_id)) == 2
    finally:
        page.context.set_offline(False)
    probe.assert_clean()


def test_visitors_get_no_worker_and_no_downloads(phone, fake_backend, base_url):
    """A visitor who never logs gets no service worker and no gym copy (nothing downloaded in the background)."""
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    page.goto(base_url + "/fitness/progress", wait_until="networkidle")
    page.wait_for_timeout(1500)
    registered = page.evaluate("async () => navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0")
    assert registered == 0
    has_copy = page.evaluate("async () => (await caches.keys()).includes('gym-runtime-v1')")
    assert has_copy is False
    probe.assert_clean()
