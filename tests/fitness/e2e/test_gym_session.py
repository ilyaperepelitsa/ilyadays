"""The gym flow on a phone, end to end: start, one tap per set, steppers, reload, swap, end, the next day, progression,
visitors and no signal (plans/fitness/12-qa-and-launch.md); then the QA fixes of 2026-11-09 (plans/fitness/
04-session-tracker-ui.md): the rest timer and a session left open, the gym page's missing machines, goal and days,
reopening a session and the way back from the summary.

Run through `bash scripts/fitness-e2e.sh` (production build + server), or against a running server:

    FITNESS_E2E_BASE=http://localhost:3123 python -m pytest tests/fitness/e2e/test_gym_session.py -q

Elements are found only by the data-testid hooks of plans/fitness/00-master-plan.md §15 and their data-* attributes,
never by visible text (the UI is bilingual) or CSS classes. FakeBackend (conftest.py) plays the backend: "missing" =
the fitness tables do not exist (production today), "public" = the owner's log seen by a visitor, "down" = no signal.

FITNESS_E2E_SHOTS=<folder> saves numbered phone screenshots of the main steps of the first test (NN-step.png) and the
taps it took (taps.json: one entry per logged set, plus start, swap and end).
"""
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect

from conftest import OWNER_ID, FakeBackend, PageProbe, no_horizontal_scroll

SHOTS = os.environ.get("FITNESS_E2E_SHOTS")
STEPPERS = ("reps-minus", "reps-plus", "kg-minus", "kg-plus")
MAX_SETS = 80  # more sets than any planned day has; a loop that reaches it is stuck
expect.set_options(timeout=10_000)

LOGGED = "[data-testid='set-row'][data-state='done'], [data-testid='set-row'][data-state='failed']"
CURRENT = """el => ({
  slot: el.closest("[data-testid='exercise-card']").dataset.slotId,
  kind: el.dataset.kind, index: el.dataset.index, state: el.dataset.state,
  kg: Number(el.dataset.kg), reps: Number(el.dataset.reps),
})"""
PLAN = """() => Object.fromEntries([...document.querySelectorAll("[data-testid='exercise-card']")].map((card) => [
  card.dataset.slotId,
  [...card.querySelectorAll("[data-testid='set-row'][data-kind='working']")]
    .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
    .map((row) => [Number(row.dataset.kg), Number(row.dataset.reps)]),
]))"""
STORED_SETS = """(sessionId) => {
  const byId = new Map();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!/^ilyadays-fitness:[^:]+:snapshot$/.test(key)) continue;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(key)); } catch { continue; }
    const sets = ((data && data.snapshot) || data || {}).sets || {};
    for (const s of Object.values(sets)) {
      if (s && s.sessionId === sessionId) byId.set(s.id, { slot: s.slotId, kind: s.kind, index: String(s.setIndex), kg: s.kg, reps: s.reps });
    }
  }
  return [...byId.values()];
}"""
# after its tap a row is done; the warm-ups of every exercise but the first fold away once the last one is logged
DONE_OR_FOLDED = """([slot, kind, index]) => {
  const card = document.querySelector(`[data-testid='exercise-card'][data-slot-id='${slot}']`);
  const row = card && card.querySelector(`[data-testid='set-row'][data-kind='${kind}'][data-index='${index}']`);
  if (!row) return kind === 'warmup' ? 'folded' : null;
  return ['done', 'failed'].includes(row.dataset.state) ? row.dataset.state : null;
}"""
SCROLL_SETTLED = """() => new Promise((resolve) => {
  let y = window.scrollY, still = 0;
  const tick = () => { if (window.scrollY === y) still += 1; else { y = window.scrollY; still = 0; } if (still > 8) resolve(y); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})"""
# one table of the stored snapshot (every project's copy), by id
STORED = """(table) => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!/^ilyadays-fitness:[^:]+:snapshot$/.test(key)) continue;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(key)); } catch { continue; }
    Object.assign(out, ((data && data.snapshot) || data || {})[table] || {});
  }
  return out;
}"""
# move a session and its sets back in time in the stored copy (snapshot and outbox): a phone left in a pocket
SHIFT_SESSION = """([sessionId, ms]) => {
  const back = (iso) => (typeof iso === 'string' && !Number.isNaN(Date.parse(iso)) ? new Date(Date.parse(iso) - ms).toISOString() : iso);
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach((x) => walk(x));
    if (!v || typeof v !== 'object') return;
    if (v.id === sessionId && 'startedAt' in v) for (const k of ['startedAt', 'endedAt', 'updatedAt']) v[k] = back(v[k]);
    if (v.sessionId === sessionId && 'doneAt' in v) for (const k of ['doneAt', 'updatedAt']) v[k] = back(v[k]);
    Object.values(v).forEach((x) => walk(x));
  };
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!/^ilyadays-fitness:[^:]+:(snapshot|outbox)$/.test(key)) continue;
    const data = JSON.parse(localStorage.getItem(key));
    walk(data);
    localStorage.setItem(key, JSON.stringify(data));
    n += 1;
  }
  return n;
}"""


# ------------------------------------------------------------------ helpers


def tid(scope, name):
    return scope.locator(f"[data-testid='{name}']")


def card(page, slot):
    return page.locator(f"[data-testid='exercise-card'][data-slot-id='{slot}']")


def row_at(page, slot, kind, index):
    return card(page, slot).locator(f"[data-testid='set-row'][data-kind='{kind}'][data-index='{index}']")


def num(v):
    """A number as React writes it into a data-* attribute (20 → "20", 12.5 → "12.5")."""
    return str(int(v)) if float(v).is_integer() else str(v)


def block_realtime(page):
    """The conftest's HTTP route for /realtime/v1/ does not catch WebSockets: mock the socket so no test reaches the
    real project (the mocked socket never answers; the store keeps its pulled rows)."""
    page.context.route_web_socket(re.compile(r".*/realtime/v1/.*"), lambda ws: None)


class Taps:
    """Every tap of a test, grouped per step: how many taps one logged set took (master plan rule 2)."""

    def __init__(self):
        self.log, self._since = [], 0

    def tap(self, locator):
        locator.tap()
        self._since += 1

    def mark(self, step):
        self.log.append({"step": step, "taps": self._since})
        self._since = 0


class Shots:
    """Numbered viewport screenshots (what the thumb sees) when FITNESS_E2E_SHOTS names a folder."""

    def __init__(self, folder):
        self.dir, self.n = (Path(folder) if folder else None), 0
        if self.dir:
            self.dir.mkdir(parents=True, exist_ok=True)
            for old in self.dir.glob("[0-9][0-9]-*.png"):
                old.unlink()

    def __call__(self, page, step):
        if self.dir:
            self.n += 1
            page.evaluate(SCROLL_SETTLED)  # smooth scrolls and the sheet's slide-in finish first
            page.wait_for_timeout(350)
            page.screenshot(path=str(self.dir / f"{self.n:02d}-{step}.png"))

    def write(self, name, data):
        if self.dir:
            (self.dir / name).write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")


def current_set(page):
    """The set the set-done button belongs to: its card's slot, kind, index, state and the kg / reps it shows."""
    row = page.locator("[data-testid='set-row']").filter(has=tid(page, "set-done"))
    expect(row).to_have_count(1)
    return row.evaluate(CURRENT)


def stored_sets(page, session_id):
    """This session's sets in the stored snapshot (localStorage), deduplicated by id."""
    return page.evaluate(STORED_SETS, session_id)


def log_current(page, taps=None, reps_plus=0):
    """Log the current set with ONE tap on set-done (after `reps_plus` taps on its reps-plus): its row turns done at
    once with the shown numbers (a finished warm-up group may fold away instead), and the stored snapshot holds exactly
    one set for that row with those numbers. Returns the set (slot, kind, index, kg, reps as logged)."""
    s = current_set(page)
    assert s["state"] == "planned", s
    session_id = tid(page, "session").get_attribute("data-session-id")
    row = row_at(page, s["slot"], s["kind"], s["index"])
    tap = taps.tap if taps else (lambda loc: loc.tap())
    for i in range(reps_plus):
        tap(tid(row, "reps-plus"))
        expect(row).to_have_attribute("data-reps", num(s["reps"] + i + 1))
    tap(tid(row, "set-done"))
    shown = page.wait_for_function(DONE_OR_FOLDED, arg=[s["slot"], s["kind"], s["index"]], timeout=10_000).json_value()
    if shown in ("done", "failed"):
        expect(row).to_have_attribute("data-reps", num(s["reps"] + reps_plus))
        expect(row).to_have_attribute("data-kg", num(s["kg"]))
    mine = [x for x in stored_sets(page, session_id) if (x["slot"], x["kind"], x["index"]) == (s["slot"], s["kind"], s["index"])]
    assert [(x["kg"], x["reps"]) for x in mine] == [(s["kg"], s["reps"] + reps_plus)], (s, mine)
    if taps:
        taps.mark(f"set {s['slot']} {s['kind']} #{s['index']}")
    return {**s, "state": "done", "reps": s["reps"] + reps_plus}


def log_until_working(page, n):
    """Log sets in the app's order (warm-ups first) until `n` working sets are done."""
    done = []
    for _ in range(MAX_SETS):
        s = log_current(page)
        if s["kind"] == "working":
            done.append(s)
            if len(done) == n:
                return done
    raise AssertionError(f"{n} working sets not reached")


def log_all(page, report_effort=False):
    """Log every planned set as planned, until no set-done button is left."""
    logged = []
    for _ in range(MAX_SETS):
        if tid(page, "set-done").count() == 0:
            return logged
        if report_effort:
            s = current_set(page)
            if s["kind"] != "warmup":
                row = row_at(page, s["slot"], s["kind"], s["index"])
                rir = row.get_attribute("data-target-rir")
                row.locator(f"[data-testid='rir-choice'][data-value='{rir}']").tap()
        logged.append(log_current(page))
    raise AssertionError("set-done never went away")


def start_session(page, taps=None):
    """Tap the train page's start-session; returns the new session's id."""
    button = tid(page, "start-session")
    expect(button).to_be_enabled()
    (taps.tap if taps else (lambda loc: loc.tap()))(button)
    session = tid(page, "session")
    expect(session).to_be_visible()
    expect(session).to_have_attribute("data-status", "active")
    return session.get_attribute("data-session-id")


def end_session(page, session_id, taps=None):
    page.wait_for_timeout(800)  # last Done's double-tap shield must expire before a distinct End tap
    tap = taps.tap if taps else (lambda loc: loc.tap())
    tap(tid(page, "end-session"))
    tap(tid(page, "end-confirm"))
    summary = tid(page, "session-summary")
    expect(summary).to_be_visible()
    expect(summary).to_have_attribute("data-session-id", session_id)


def open_train(page, base_url, day_key, path="/fitness/train"):
    page.goto(base_url + path)
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", day_key)


def eventually(check):
    """True when an expect(...) check passes within its timeout, False when it times out."""
    try:
        check()
        return True
    except AssertionError:
        return False


def missing_tables(page):
    backend = FakeBackend(page)
    backend.state = "missing"
    block_realtime(page)
    return backend


def stored(page, table):
    """One table of the stored snapshot (localStorage: sessions, exerciseState, …), by id."""
    return page.evaluate(STORED, table)


def without(states, *fields):
    """Exercise states without some fields (their write times): what the next session plans from."""
    return {k: {f: v for f, v in s.items() if f not in fields} for k, s in states.items()}


def iso(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def js_iso(moment):
    """A datetime as Date#toISOString writes it (UTC, milliseconds)."""
    moment = moment.astimezone(timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def blank_page(page, base_url):
    """A page of the site's origin without the app (robots.txt): the stored copy can change while no store runs."""
    page.goto(base_url + "/robots.txt")


def wait_until(page, check, what, timeout_ms=10_000):
    """Poll a Python check (storage written by an effect) until it holds."""
    for _ in range(timeout_ms // 100):
        if check():
            return
        page.wait_for_timeout(100)
    raise AssertionError(f"timed out waiting until {what}")


def mark_missing(page, exercise_id):
    """One tap on a machine's chip on the gyms page (not a checklist: here → not here)."""
    chip = page.locator(f"[data-testid='machine-toggle'][data-exercise-id='{exercise_id}']")
    expect(chip).to_have_count(1)
    chip.tap()
    expect(chip).to_have_attribute("data-available", "false")


# ------------------------------------------------------------------ tests


def test_logging_works_when_the_fitness_tables_are_missing(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    shots, taps = Shots(SHOTS), Taps()

    page.goto(base_url + "/fitness")
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "A")
    shots(page, "home-local")
    taps.tap(tid(page, "start-session"))
    expect(page).to_have_url(re.compile(r"/fitness/train/?$"))
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "A")
    shots(page, "train-start")
    session_id = start_session(page, taps)
    taps.mark("start (home Start, then train Start)")
    shots(page, "session-started")

    logged, working = [], []
    for _ in range(MAX_SETS):
        s = log_current(page, taps)
        logged.append(s)
        if s["kind"] == "working":
            working.append(s)
            if len(working) == 1:
                shots(page, "first-working-set-done")
            if len(working) == 3:
                break
    assert len(working) == 3, working

    adjusted = log_current(page, taps, reps_plus=1)  # asserts data-reps rose by one
    logged.append(adjusted)
    shots(page, "reps-plus-then-done")
    assert len(stored_sets(page, session_id)) == len(logged)

    page.reload()
    expect(tid(page, "session")).to_have_attribute("data-session-id", session_id)
    for s in [*working, adjusted]:
        row = row_at(page, s["slot"], s["kind"], s["index"])
        expect(row).to_have_attribute("data-state", "done")
        expect(row).to_have_attribute("data-reps", num(s["reps"]))
        expect(row).to_have_attribute("data-kg", num(s["kg"]))
    expect(page.locator(LOGGED)).to_have_count(len(logged))
    shots(page, "after-reload")

    # the machine of the next exercise is taken: swap it for today
    slot = current_set(page)["slot"]
    target = card(page, slot)
    expect(target.locator(LOGGED)).to_have_count(0)
    before, planned = target.get_attribute("data-exercise-id"), target.get_attribute("data-slot-exercise-id")
    taps.tap(tid(target, "swap-open"))
    options = tid(page, "swap-option")
    expect(options.first).to_be_visible()
    shots(page, "swap-sheet")
    choice = next(i for i in (o.get_attribute("data-exercise-id") for o in options.all()) if i != before)
    taps.tap(page.locator(f"[data-testid='swap-option'][data-exercise-id='{choice}']"))
    taps.mark(f"swap {slot}")
    expect(target).to_have_attribute("data-exercise-id", choice)
    expect(target).to_have_attribute("data-slot-exercise-id", planned)
    shots(page, "swapped")
    page.reload()
    expect(target).to_have_attribute("data-exercise-id", choice)  # today's swap survives a reload on this phone

    taps.tap(tid(page, "end-session"))
    expect(tid(page, "end-confirm")).to_be_visible()
    shots(page, "end-sheet")
    taps.tap(tid(page, "end-confirm"))
    taps.mark("end")
    expect(tid(page, "session-summary")).to_have_attribute("data-session-id", session_id)
    shots(page, "summary")

    page.goto(base_url + "/fitness")
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B")
    shots(page, "home-next-B")
    shots.write("taps.json", taps.log)
    print("taps:", json.dumps(taps.log, ensure_ascii=False))
    per_set = [t["taps"] for t in taps.log if t["step"].startswith("set ")]
    assert per_set == [1] * (len(logged) - 1) + [2], per_set  # as planned: 1 tap; one adjustment: 2
    probe.assert_clean()


def test_progression_after_a_full_rotation(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    probes = [probe]

    def next_day_tab(current):
        """The next gym day: a new tab on the same phone (same localStorage, no summary in sessionStorage)."""
        tab = current.context.new_page()
        probes.append(PageProbe(tab))
        current.close()
        return tab

    open_train(page, base_url, "A")
    first_id = start_session(page)
    first_plan = page.evaluate(PLAN)
    logged = log_all(page, report_effort=True)
    assert {s["slot"] for s in logged if s["kind"] == "working"} == set(first_plan), "every slot of A was logged"
    end_session(page, first_id)

    for day in ("B", "C"):
        page = next_day_tab(page)
        open_train(page, base_url, day)
        session_id = start_session(page)
        log_until_working(page, 1)
        end_session(page, session_id)

    page = next_day_tab(page)
    open_train(page, base_url, "A")
    start_session(page)
    next_plan = page.evaluate(PLAN)

    def higher(before, after):
        return all(k2 > k1 or (k2 == k1 and r2 > r1) for (k1, r1), (k2, r2) in zip(before, after)) and len(before) == len(after)

    first_slot = next(iter(first_plan))
    assert higher(first_plan[first_slot], next_plan[first_slot]), f"{first_slot}: {first_plan[first_slot]} → {next_plan[first_slot]}"
    flat = {slot: (first_plan[slot], next_plan.get(slot)) for slot in first_plan if not higher(first_plan[slot], next_plan.get(slot, []))}
    assert not flat, f"slots done as planned that did not progress: {flat}"
    for p in probes:
        p.assert_clean()


def test_fast_double_tap_logs_one_set(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    open_train(page, base_url, "A")
    session_id = start_session(page)

    # a fast double click on set-done
    s = current_set(page)
    row = row_at(page, s["slot"], s["kind"], s["index"])
    tid(row, "set-done").dblclick()
    expect(row).to_have_attribute("data-state", "done")
    page.wait_for_timeout(400)  # room for a second set to land if the second click logged one
    expect(page.locator(LOGGED)).to_have_count(1)
    assert len(stored_sets(page, session_id)) == 1

    # the same with a thumb mid-way through an exercise: two taps 100 ms apart on the same spot of the screen
    for _ in range(2):
        log_current(page)
        page.evaluate(SCROLL_SETTLED)
    s = current_set(page)
    assert s["kind"] == "working", s
    row = row_at(page, s["slot"], s["kind"], s["index"])
    # Right after a set is logged, the next Done stays disabled for under a second (the double-tap shield, plan 04
    # "QA fixes 2026-11-09"); a real thumb comes back after resting, so wait until it is armed again, then tap twice.
    expect(tid(row, "set-done")).to_be_enabled()
    page.evaluate(SCROLL_SETTLED)
    box = tid(row, "set-done").bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.touchscreen.tap(x, y)
    page.wait_for_timeout(100)
    page.touchscreen.tap(x, y)
    expect(row).to_have_attribute("data-state", "done")
    page.wait_for_timeout(400)
    logged = stored_sets(page, session_id)
    assert len(logged) == 4, f"a double tap logged {len(logged) - 3} sets: {logged[3:]}"
    expect(page.locator(LOGGED)).to_have_count(4)
    probe.assert_clean()


def owner_session(day_key, start, plan, finished=True):
    """One session of the owner and its sets as PostgREST returns them (column names of
    supabase/migrations/20261108120000_fitness.sql). `plan` = [(slot, exercise, [(kind, kg, reps), ...]), ...]."""
    session_id = str(uuid.uuid4())
    sets, t = [], start + timedelta(minutes=8)
    for slot, exercise, rows in plan:
        for index, (kind, kg, reps) in enumerate(rows):
            t += timedelta(minutes=3)
            sets.append({"id": str(uuid.uuid4()), "user_id": OWNER_ID, "session_id": session_id, "slot_id": slot,
                         "exercise_id": exercise, "set_index": index, "kind": kind, "planned_kg": kg,
                         "planned_reps": reps, "kg": kg, "reps": reps, "rir": None if kind == "warmup" else 2,
                         "done_at": t.isoformat(), "created_at": t.isoformat(), "updated_at": t.isoformat()})
    end = t + timedelta(minutes=5)
    session = {"id": session_id, "user_id": OWNER_ID, "program_id": None, "gym_id": None, "day_key": day_key,
               "started_at": start.isoformat(), "ended_at": end.isoformat() if finished else None,
               "status": "finished" if finished else "active", "bodyweight_kg": 82.4, "readiness": {}, "notes": "",
               "created_at": start.isoformat(), "updated_at": (end if finished else t).isoformat()}
    return session, sets


def owner_log():
    """The owner's public rows: yesterday's finished day A with the warm-ups and working sets of A1 and A2, a weigh-in
    and the owner's profile with settings."""
    start = (datetime.now(timezone.utc) - timedelta(days=1)).replace(hour=15, minute=0, second=0, microsecond=0)
    session, sets = owner_session("A", start, [
        ("A1", "machine-chest-press", [("warmup", 10, 8), ("warmup", 15, 4)] + [("working", 20, 6)] * 4),
        ("A2", "lat-pulldown", [("warmup", 15, 8), ("warmup", 20, 4)] + [("working", 25, 6)] * 3),
    ])
    settings = {"goal": "recomp", "daysPerWeek": 3, "bodyweightKg": 82.4, "activeGymId": None, "unit": "kg",
                "restTimer": True, "autoCloseHours": 6, "updatedAt": start.isoformat()}
    profile = {"user_id": OWNER_ID, "display_name": "Ilya", "is_owner": True, "settings": settings,
               "created_at": start.isoformat(), "updated_at": start.isoformat()}
    weigh_in = {"id": str(uuid.uuid4()), "user_id": OWNER_ID, "measured_at": start.isoformat(), "weight_kg": 82.4,
                "body_fat_pct": None, "note": "", "created_at": start.isoformat(), "updated_at": start.isoformat()}
    return {"fitness_profiles": [profile], "fitness_sessions": [session], "fitness_sets": sets,
            "fitness_bodyweight": [weigh_in]}


def write_controls(page):
    """Logging controls present on the page: start-session, set-done and any stepper (train or program)."""
    found = {name: tid(page, name).count() for name in ("start-session", "set-done", *STEPPERS)}
    found["*-minus / *-plus"] = page.locator("[data-testid$='-minus'], [data-testid$='-plus']").count()
    return {k: v for k, v in found.items() if v}


def test_visitor_cannot_log(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "public"
    fake_backend.rows = owner_log()
    block_realtime(page)

    seen = {}
    for path in ("/fitness", "/fitness/train", "/fitness/program", "/fitness/gyms"):
        page.goto(base_url + path)
        expect(tid(page, "mode-note")).to_have_attribute("data-mode", "viewer")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(300)
        seen[path] = write_controls(page)
        if path == "/fitness/program":
            tid(page, "program-settings-toggle").click()
            expect(tid(page, "goal-select")).to_be_visible()
            pressable = page.locator("[data-testid='goal-select'] input:enabled, [data-testid='days-select'] button:enabled").count()
            if pressable:
                seen[path]["goal / days buttons"] = pressable
    assert not any(seen.values()), f"a visitor sees logging controls: {seen}"

    # the owner's finished day A: the visitor's train page shows the rotation moved on to B (the owner's log was read),
    # or the progress page charts it
    page.goto(base_url + "/fitness/train")
    shows_on_train = eventually(lambda: expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B"))
    page.goto(base_url + "/fitness/progress")
    expect(tid(page, "mode-note").first).to_have_attribute("data-mode", "viewer")
    shows_on_progress = not shows_on_train and eventually(lambda: expect(tid(page, "chart").first).to_be_visible())
    assert shows_on_train or shows_on_progress, "the owner's session is visible to a visitor on train or progress"
    assert write_controls(page) == {}, write_controls(page)
    assert fake_backend.writes == [], fake_backend.writes
    expect(tid(page, "mode-note")).to_have_count(1)  # one store note per page (master plan §14)
    probe.assert_clean()


def test_visitor_watches_the_live_session(phone, fake_backend, base_url):
    page, probe = phone
    rows = owner_log()
    start = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(minutes=25)
    live, live_sets = owner_session("B", start, [("B1", "assisted-pull-up", [("warmup", 65, 8), ("working", 55, 8), ("working", 55, 8)])],
                                    finished=False)
    rows["fitness_sessions"].append(live)
    rows["fitness_sets"] += live_sets
    fake_backend.state = "public"
    fake_backend.rows = rows
    block_realtime(page)

    page.goto(base_url + "/fitness/train")
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "viewer")
    session = tid(page, "session")
    expect(session).to_have_attribute("data-session-id", live["id"])
    expect(session).to_have_attribute("data-status", "active")
    expect(card(page, "B1").locator(LOGGED)).to_have_count(len(live_sets))
    page.wait_for_load_state("networkidle")
    controls = write_controls(page)
    controls.update({name: n for name in ("end-session", "swap-open", "end-confirm") if (n := tid(page, name).count())})
    assert controls == {}, f"a visitor watching a live session sees logging controls: {controls}"
    assert fake_backend.writes == [], fake_backend.writes
    probe.assert_clean()


def test_no_signal_keeps_logging(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    open_train(page, base_url, "A")
    session_id = start_session(page)
    first = log_current(page)

    fake_backend.state = "down"
    page.reload()
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
    expect(tid(page, "session")).to_have_attribute("data-session-id", session_id)
    expect(row_at(page, first["slot"], first["kind"], first["index"])).to_have_attribute("data-state", "done")
    second = log_current(page)
    assert (second["slot"], second["index"]) != (first["slot"], first["index"])
    expect(page.locator(LOGGED)).to_have_count(2)
    assert len(stored_sets(page, session_id)) == 2
    probe.assert_clean()


def test_russian_small_phone_first_set(small_phone, base_url):
    page, probe = small_phone
    missing_tables(page)
    open_train(page, base_url, "A", path="/ru/fitness/train")
    assert page.evaluate("() => document.documentElement.lang") == "ru"
    no_horizontal_scroll(page)
    start_session(page)
    no_horizontal_scroll(page)
    log_current(page)
    expect(tid(page, "rest-timer")).to_be_visible()
    no_horizontal_scroll(page)
    probe.assert_clean()


def done_box(page):
    page.evaluate(SCROLL_SETTLED)
    return tid(page, "set-done").bounding_box()


def bar_top(page):
    """Top of the sticky bottom bar: the rest timer while it shows, else the End button's row."""
    timer = tid(page, "rest-timer")
    box = (timer if timer.count() else tid(page, "end-session")).bounding_box()
    return box["y"]


def test_done_is_big_and_the_bar_never_covers_a_row(small_phone, base_url):
    page, probe = small_phone
    missing_tables(page)
    open_train(page, base_url, "A")
    start_session(page)
    for _ in range(3):  # before the first set, then with the rest timer making the bar taller
        box = done_box(page)
        assert box["width"] >= 56 and box["height"] >= 56, f"Done is {box['width']}×{box['height']} px"
        assert box["y"] >= 0 and box["y"] + box["height"] <= bar_top(page) + 0.5, f"Done {box} is under the bar at {bar_top(page)}"
        log_current(page)
    # the last row of the day can always be scrolled above the bar
    page.evaluate("() => window.scrollTo(0, document.documentElement.scrollHeight)")
    page.evaluate(SCROLL_SETTLED)
    last = page.locator("[data-testid='set-row']").last.bounding_box()
    assert last["y"] + last["height"] <= bar_top(page) + 0.5, f"the last set row {last} is under the bar at {bar_top(page)}"
    probe.assert_clean()


def test_rest_timer_survives_a_reload(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    open_train(page, base_url, "A")
    session_id = start_session(page)
    log_until_working(page, 1)
    timer = tid(page, "rest-timer")
    expect(timer).to_be_visible()
    ends = iso(timer.get_attribute("data-ends-at"))
    assert ends > datetime.now(timezone.utc), f"the rest after a working set is still running: {ends}"
    expect(tid(page, "set-done")).to_be_enabled()  # past the double-tap shield
    timer.locator("[data-testid='rest-adjust'][data-delta='30']").tap()
    longer = js_iso(ends + timedelta(seconds=30))
    expect(timer).to_have_attribute("data-ends-at", longer)
    page.reload()
    expect(tid(page, "session")).to_have_attribute("data-session-id", session_id)
    expect(tid(page, "rest-timer")).to_have_attribute("data-ends-at", longer)  # same end, +30 s kept
    probe.assert_clean()


def test_a_session_left_open_for_6_hours_is_closed_on_load(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    open_train(page, base_url, "A")
    session_id = start_session(page)
    worked = log_until_working(page, 2)
    exercise = card(page, worked[0]["slot"]).get_attribute("data-exercise-id")
    assert exercise not in stored(page, "exerciseState"), "a first session: no targets before it ends"

    # the phone stayed in the pocket, the tab open: seven hours later the train page opens again
    blank_page(page, base_url)
    assert page.evaluate(SHIFT_SESSION, [session_id, 7 * 3600_000]) >= 1
    page.goto(base_url + "/fitness/train")
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
    expect(tid(page, "auto-closed")).to_have_attribute("data-session-id", session_id)
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B")  # it counts as trained: the rotation moves on
    expect(tid(page, "session")).to_have_count(0)
    wait_until(page, lambda: exercise in stored(page, "exerciseState"), f"the close-out wrote the targets of {exercise}")
    session = stored(page, "sessions")[session_id]
    assert session["status"] == "auto_closed", session
    assert iso(session["endedAt"]) - iso(session["startedAt"]) == timedelta(hours=6), session
    state = stored(page, "exerciseState")[exercise]
    assert iso(state["lastAt"]) >= iso(session["startedAt"]), state  # its sets were applied
    page.reload()
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B")
    page.wait_for_load_state("networkidle")
    assert stored(page, "exerciseState")[exercise] == state, "applied once"
    probe.assert_clean()


def test_a_machine_marked_missing_swaps_the_plan_and_the_sheet_explains(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    page.goto(base_url + "/fitness/gyms")
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
    tid(page, "gym-create-name").fill("Gym near home")
    tid(page, "gym-create").tap()
    expect(tid(page, "gym-card")).to_have_attribute("data-active", "true")
    a3 = page.locator("[data-testid='plan-slot'][data-slot-id='A3']")
    expect(a3).to_have_attribute("data-exercise-id", "pec-deck")
    mark_missing(page, "pec-deck")
    expect(a3).to_have_attribute("data-exercise-id", "cable-fly")  # the plan swaps at once
    expect(a3).to_have_attribute("data-status", "swapped")

    page.goto(base_url + "/fitness/train")
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "A")
    session_id = start_session(page)
    target = card(page, "A3")
    expect(target).to_have_attribute("data-exercise-id", "cable-fly")
    expect(target).to_have_attribute("data-slot-exercise-id", "pec-deck")
    tid(target, "swap-open").tap()
    options = tid(page, "swap-option")
    expect(options.first).to_be_visible()
    assert [o.get_attribute("data-exercise-id") for o in options.all()] == ["dumbbell-fly", "high-to-low-cable-fly", "low-to-high-cable-fly"]
    page.keyboard.press("Escape")
    expect(options).to_have_count(0)

    # mid-session: this gym has no fly machine at all
    page.goto(base_url + "/fitness/gyms")
    page.locator("[data-testid='group-toggle'][data-group='chest']").tap()
    for exercise_id in ("cable-fly", "dumbbell-fly", "high-to-low-cable-fly", "low-to-high-cable-fly"):
        mark_missing(page, exercise_id)
    expect(a3).to_have_attribute("data-status", "stuck")
    expect(a3).to_have_attribute("data-exercise-id", "pec-deck")

    page.goto(base_url + "/fitness/train")
    expect(tid(page, "session")).to_have_attribute("data-session-id", session_id)
    expect(target).to_have_attribute("data-exercise-id", "pec-deck")
    tid(target, "swap-open").tap()
    empty = tid(page, "swap-empty")
    expect(empty).to_be_visible()
    expect(empty).to_have_attribute("data-missing", "4")
    expect(tid(page, "swap-option")).to_have_count(0)
    tid(page, "swap-skip").tap()
    expect(empty).to_have_count(0)
    rows = target.locator("[data-testid='set-row'][data-kind='working']")
    expect(rows).to_have_count(3)
    for i in range(3):
        expect(rows.nth(i)).to_have_attribute("data-state", "skipped")
    probe.assert_clean()


def test_goal_and_days_survive_a_reload(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    page.goto(base_url + "/fitness/program")
    tid(page, "program-settings-toggle").click()
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "local")
    summary, goal, days = tid(page, "program-summary"), tid(page, "goal-select"), tid(page, "days-select")
    expect(summary).to_have_attribute("data-editable", "true")
    expect(goal).to_have_attribute("data-value", "recomp")
    expect(days).to_have_attribute("data-value", "3")

    goal.locator("[data-value='strength']").tap()
    expect(goal).to_have_attribute("data-value", "strength")
    tid(page, "program-save").tap()
    expect(tid(page, "program-saved")).to_be_visible()
    page.reload()
    tid(page, "program-settings-toggle").click()
    expect(summary).to_have_attribute("data-editable", "true")
    expect(goal).to_have_attribute("data-value", "strength")

    days.locator("[data-value='2']").tap()
    expect(days).to_have_attribute("data-value", "2")
    tid(page, "program-save").tap()
    expect(tid(page, "program-saved")).to_be_visible()
    page.reload()
    tid(page, "program-settings-toggle").click()
    expect(summary).to_have_attribute("data-editable", "true")
    expect(days).to_have_attribute("data-value", "2")
    expect(goal).to_have_attribute("data-value", "strength")
    expect(tid(page, "program-day")).to_have_count(2)

    page.goto(base_url + "/fitness/train")  # the train page plans the saved version
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "A")
    expect(tid(page, "day-pick")).to_have_count(2)
    probe.assert_clean()


def test_reopen_restores_the_next_targets(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    # day A once as planned: its exercises get their first targets
    open_train(page, base_url, "A")
    first_id = start_session(page)
    log_all(page)
    end_session(page, first_id)
    tid(page, "summary-done").tap()
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B")

    # day A again (picked on the start panel), every set as planned: End moves the targets on
    tid(page, "start-session").tap()
    page.locator("[data-testid='day-pick'][data-value='A']").tap()
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "A")
    session_id = start_session(page)
    before = stored(page, "exerciseState")
    assert before, "the first End wrote targets"
    logged = log_all(page)
    end_session(page, session_id)
    after = stored(page, "exerciseState")
    assert without(after, "updatedAt", "lastAt") != without(before, "updatedAt", "lastAt"), "End moved the targets on"

    # Reopen: the session runs again with its sets, and the targets are the ones from before this End
    tid(page, "session-reopen").tap()
    session = tid(page, "session")
    expect(session).to_have_attribute("data-session-id", session_id)
    expect(session).to_have_attribute("data-status", "active")
    working = [s for s in logged if s["kind"] == "working"]
    expect(page.locator("[data-testid='set-row'][data-kind='working']").and_(page.locator(LOGGED))).to_have_count(len(working))
    assert len(stored_sets(page, session_id)) == len(logged), "every set is still there (folded warm-ups included)"
    assert without(stored(page, "exerciseState"), "updatedAt") == without(before, "updatedAt")
    # ending again works the same targets out from the same sets
    end_session(page, session_id)
    assert without(stored(page, "exerciseState"), "updatedAt", "lastAt") == without(after, "updatedAt", "lastAt")
    probe.assert_clean()


def test_done_on_the_summary_leads_to_the_next_day(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    open_train(page, base_url, "A")
    session_id = start_session(page)
    log_until_working(page, 1)
    end_session(page, session_id)
    page.reload()
    expect(tid(page, "session-summary")).to_have_attribute("data-session-id", session_id)  # a reload keeps the summary
    tid(page, "summary-done").tap()
    expect(page).to_have_url(re.compile(r"/fitness/?$"))
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B")
    tid(page, "start-session").tap()
    expect(page).to_have_url(re.compile(r"/fitness/train/?$"))
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B")
    expect(tid(page, "session-summary")).to_have_count(0)
    page.reload()
    expect(tid(page, "next-session")).to_have_attribute("data-day-key", "B")
    expect(tid(page, "session-summary")).to_have_count(0)
    start_session(page)
    probe.assert_clean()


def test_missed_reps_are_preserved_and_advice_survives_reload(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    block_realtime(page)
    open_train(page, base_url, "A")
    session_id = start_session(page)
    shots = Shots(os.environ.get("FITNESS_CALIBRATION_SHOTS"))
    no_horizontal_scroll(page)
    shots(page, "baseline-guide")
    # Seed an established 20 × 10 prescription in the saved workout context.
    page.evaluate("""(sessionId) => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!/^ilyadays-fitness:[^:]+:snapshot$/.test(key)) continue;
        const data = JSON.parse(localStorage.getItem(key));
        const snap = data.snapshot || data;
        const session = snap.sessions?.[sessionId];
        if (!session?.plan) continue;
        const p = session.plan.prescription.exercises[0];
        p.calibration = false; p.repRange = [6, 10]; p.loadStep = 5;
        for (const s of p.sets) if (s.kind === 'working') { s.weightKg = 20; s.reps = 10; s.rir = 2; }
        const state = { exerciseId:p.exerciseId, workingKg:20, targetReps:10, repRange:[6,10], rir:2,
          e1rm:25, lastOutcome:'held', fails:0, sessions:3, lastAt:new Date(Date.now()-86400000).toISOString(), updatedAt:session.startedAt };
        snap.exerciseState[p.exerciseId] = state;
        session.plan.states[p.exerciseId] = state;
        localStorage.setItem(key, JSON.stringify(data));
      }
    }""", session_id)
    page.reload()
    expect(tid(page, "session")).to_be_visible()
    while current_set(page)["kind"] == "warmup":
        log_current(page)
    first = current_set(page)
    assert (first["kg"], first["reps"]) == (20, 10)
    row = row_at(page, first["slot"], first["kind"], first["index"])
    tid(row, "reps-minus").tap()
    tid(row, "reps-minus").tap()
    row.locator("[data-testid='rir-choice'][data-value='2']").tap()
    tid(row, "set-done").tap()
    expect(row).to_have_attribute("data-state", "failed")
    target = card(page, first["slot"])
    pending = target.locator("[data-testid='set-row'][data-kind='working'][data-state='planned']").first
    expect(pending).to_have_attribute("data-kg", "20")
    expect(pending).to_have_attribute("data-reps", "8")
    expect(tid(pending, "set-advice")).to_be_visible()
    shots(page, "actual-eight-next-eight")
    page.reload()
    expect(pending).to_have_attribute("data-reps", "8")
    actual = next(s for s in stored(page, "sets").values() if s["sessionId"] == session_id and s["kind"] == "working")
    assert (actual["plannedReps"], actual["reps"], actual["kg"]) == (10, 8, 20)
    assert actual["prescription"]["rirReported"] is True
    log_all(page)
    end_session(page, session_id)
    state = stored(page, "exerciseState")[actual["exerciseId"]]
    assert state["workingKg"] <= 20
    assert state["lastOutcome"] != "progressed"
    no_horizontal_scroll(page)
    probe.assert_clean()
