"""Training plans and training lives, by tapping the real buttons: five different plans built in the plan editor, every
button of the session screen, and months of visits with skipped weeks, holidays, short and forgotten sessions, a sore
shoulder, and a goal or day change on the way (the walkthrough of 2026-11-24).

A seeded lifter with a true strength per exercise does what the screen says; the browser clock is moved between sets and
visits. A fake backend plays "no tables", so nothing real is written. The months take about a minute each:
they run only with FITNESS_E2E_MONTHS=1; FITNESS_E2E_WEEKS shortens the first five (default 17).
"""
import json
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from playwright.sync_api import expect

from conftest import FakeBackend, no_horizontal_scroll
from test_gym_session import (
    block_realtime, current_set, end_session, log_current, log_until_working, row_at, start_session, stored, stored_sets, tid,
)

WEEKS = int(os.environ.get("FITNESS_E2E_WEEKS", "17"))
months = pytest.mark.skipif(not os.environ.get("FITNESS_E2E_MONTHS"), reason="about an hour: set FITNESS_E2E_MONTHS=1")
T0 = datetime(2026, 11, 24, 9, 0, tzinfo=timezone.utc)
VISITS = {2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4]}

PLANS = {
    "strength": dict(name="Heavy Upper", goal="strength", days=3, scope="upper", focus=["back", "chest"]),
    "fullbody": dict(name="Two Day Full Body", goal="recomp", days=2, scope="full"),
    "hypertrophy": dict(name="Four Day Growth", goal="hypertrophy", days=4, scope="upper", template="upper-4day"),
    "endurance": dict(name="Circuit", goal="endurance", days=3, scope="full", lang="/ru"),
    "custom": dict(name="Hotel Gym", goal="maintenance", days=2, scope="custom", custom=[["push-up", "row"], ["curl", "plank"]]),
}
LIVES = {
    "strength": dict(attend=.93, away=[7], report=.7, goal_at=(11, "hypertrophy")),
    "fullbody": dict(attend=.6, away=[5, 6, 7], report=.3, short=.2, forget=.12),
    "hypertrophy": dict(attend=.88, report=.6, sore=(5, 6), days_at=(10, 3), short=.05),
    "endurance": dict(attend=.8, away=[4, 5, 6, 7, 8], report=0, short=.1),
    "custom": dict(attend=.85, away=[12], report=.5, short=.05, forget=.05),
}
# more people and patterns: (plan, weeks, life)
OTHERS = {
    "two-months-off": ("strength", 22, dict(attend=1, report=.6, away=list(range(6, 15)))),
    "four-months-off": ("strength", 32, dict(attend=1, report=.6, away=list(range(6, 24)))),
    "eight-months-off": ("fullbody", 48, dict(attend=1, report=.5, away=list(range(6, 42)))),
    "two-long-breaks": ("strength", 36, dict(attend=.95, report=.6, away=list(range(6, 14)) + list(range(19, 28)))),
    "on-and-off": ("fullbody", 30, dict(attend=1, report=.5, away=[w for w in range(30) if w % 8 >= 3])),
    "once-a-week": ("strength", 20, dict(attend=1, report=.5, visits=[5])),
    "once-a-fortnight": ("fullbody", 24, dict(attend=1, report=.5, visits=[2], away=list(range(1, 24, 2)))),
    "beginner-weak": ("strength", 12, dict(attend=.95, report=.7, scale=.55)),
    "beginner-weak-silent": ("fullbody", 12, dict(attend=.95, report=0, scale=.55)),
    "very-strong": ("hypertrophy", 12, dict(attend=.95, report=.7, scale=3)),
    "underrates-effort": ("strength", 14, dict(attend=1, report=1, bias=3)),
    "overrates-effort": ("strength", 14, dict(attend=1, report=1, bias=-2)),
}
LOADS = """() => [...document.querySelectorAll("[data-testid='exercise-card']")].map((c) => ({
  slot: c.dataset.slotId, ex: c.dataset.exerciseId,
  notes: [...c.querySelectorAll('header > .trk-note')].map((x) => x.innerText).join(' '),
  sets: [...c.querySelectorAll("[data-testid='set-row'][data-kind='working']")].map((r) => [+r.dataset.kg, +r.dataset.reps]),
}))"""


def fake(page):
    backend = FakeBackend(page)
    block_realtime(page)
    return backend


def active_program(page):
    active = [p for p in stored(page, "programs").values() if p.get("active") is not False]
    assert len(active) == 1
    return active[0]


def open_program(page, base_url, lang=""):
    page.goto(base_url + lang + "/fitness/program", wait_until="networkidle")
    tid(page, "program-settings-toggle").tap()


def build_plan(page, base_url, p):
    open_program(page, base_url, p.get("lang", ""))
    page.locator(f"[data-testid='goal-select'] [data-value='{p['goal']}'], [data-testid='goal-select'] input[value='{p['goal']}']").first.click()
    page.locator(f"[data-testid='days-select'] [data-value='{p['days']}']").tap()
    if p.get("template"):
        use = page.locator(f"[data-template-id='{p['template']}']")
        use.locator("xpath=ancestor::details[1]/summary").tap()
        use.tap()
    page.locator(f"[data-testid='plan-scope'] [data-value='{p['scope']}']").tap()
    for muscle in p.get("focus", []):
        tid(page, "plan-focus").locator(f"[data-value='{muscle}']").tap()
    tid(page, "plan-name").fill(p["name"])
    tid(page, "plan-name").blur()
    if not p.get("template"):
        build = tid(page, "plan-custom" if p.get("custom") else "plan-build")
        build.locator("xpath=ancestor::details[1]/summary").tap()
        build.tap()
    for i, queries in enumerate(p.get("custom", [])):
        for query in queries:
            day = page.locator(f"[data-testid='program-day'][data-day-key='{'AB'[i]}']")
            tid(day, "day-add").tap()
            tid(day, "day-add-search").fill(query)
            tid(day, "day-add-option").first.tap()
    no_horizontal_scroll(page)
    tid(page, "program-save").tap()
    page.wait_for_timeout(300)
    return active_program(page)


@pytest.mark.parametrize("key", PLANS)
def test_a_plan_is_built_saved_and_trained_once(small_phone, base_url, key):
    page, probe = small_phone
    fake(page)
    p = PLANS[key]
    program = build_plan(page, base_url, p)
    assert (program["goal"], program["daysPerWeek"], len(program["days"])) == (p["goal"], p["days"], p["days"])
    assert program["name"]["en"] == p["name"]
    assert all(d["slots"] for d in program["days"])
    page.goto(base_url + p.get("lang", "") + "/fitness/train", wait_until="networkidle")
    first = tid(page, "next-session").get_attribute("data-day-key")
    session = start_session(page)
    no_horizontal_scroll(page)
    for _ in range(90):
        if not tid(page, "set-done").count():
            break
        expect(tid(page, "set-done")).to_be_enabled()
        log_current(page)
    end_session(page, session)
    tid(page, "summary-done").tap()
    expect(tid(page, "next-session")).not_to_have_attribute("data-day-key", first)
    probe.assert_clean()


def test_every_button_of_a_session(phone, base_url):
    page, probe = phone
    backend = fake(page)
    build_plan(page, base_url, PLANS["fullbody"])
    page.goto(base_url + "/fitness/train", wait_until="networkidle")
    session = start_session(page)
    cards = tid(page, "exercise-card")
    act = lambda card, i: card.locator(".trk-act").nth(i)  # Technique, Swap, Skip, + Set
    second, third = cards.nth(1), cards.nth(2)
    act(second, 0).tap()
    expect(second.locator(".trk-tech")).to_be_visible()
    act(second, 0).tap()
    expect(second.locator(".trk-tech")).to_have_count(0)
    act(third, 2).tap()
    expect(act(third, 2)).to_have_attribute("aria-pressed", "true")
    act(third, 2).tap()
    expect(act(third, 2)).to_have_attribute("aria-pressed", "false")
    act(second, 3).tap()
    expect(second.locator("[data-testid='set-row'][data-kind='backoff']")).to_have_count(1)
    # out of order, and undone
    row = second.locator("[data-testid='set-row'][data-kind='working']").last
    tid(row, "set-row-done").tap()
    expect(row).to_have_attribute("data-state", "done")
    page.wait_for_timeout(800)
    row.locator(".trk-row-body").tap()
    row.locator(".trk-edit-actions button").first.tap()
    expect(row).to_have_attribute("data-state", "planned")
    assert stored_sets(page, session) == []
    # a fast double tap logs one set
    page.wait_for_timeout(800)
    tid(page, "set-done").scroll_into_view_if_needed()
    box = tid(page, "set-done").bounding_box()
    for _ in range(2):
        page.touchscreen.tap(box["x"] + 50, box["y"] + 20)
    page.wait_for_timeout(800)
    assert len(stored_sets(page, session)) == 1
    # an edit of a set not logged yet survives a reload; the swap of its exercise drops it
    s = current_set(page)
    row = row_at(page, s["slot"], s["kind"], s["index"])
    tid(row, "kg-plus").tap()
    tid(row, "reps-plus").tap()
    edited = current_set(page)
    assert edited["kg"] > s["kg"] and edited["reps"] == s["reps"] + 1
    page.reload(wait_until="networkidle")
    assert current_set(page) == edited
    log_current(page)
    assert page.evaluate("() => Object.values(JSON.parse(localStorage.getItem('ilyadays-fitness:train-ui')).sessions).every((u) => Object.keys(u.drafts ?? {}).length === 0)")
    fourth = cards.nth(3)
    before = fourth.get_attribute("data-exercise-id")
    tid(fourth, "swap-open").tap()
    tid(page, "swap-option").first.tap()
    expect(cards.nth(3)).not_to_have_attribute("data-exercise-id", before)
    # cancelling End keeps the session; a set with no signal is kept
    page.wait_for_timeout(800)
    tid(page, "end-session").tap()
    expect(tid(page, "end-confirm")).to_be_visible()
    page.keyboard.press("Escape")
    expect(tid(page, "session")).to_have_attribute("data-status", "active")
    page.wait_for_timeout(800)
    backend.state = "down"
    log_current(page)
    backend.state = "missing"
    end_session(page, session)
    tid(page, "session-reopen").tap()
    expect(tid(page, "session")).to_have_attribute("data-status", "active")
    end_session(page, session)
    probe.assert_clean()


def test_an_unlogged_edit_is_dropped_by_a_swap(phone, base_url):
    page, _ = phone
    fake(page)
    page.goto(base_url + "/fitness/train", wait_until="networkidle")
    start_session(page)
    s = current_set(page)
    tid(row_at(page, s["slot"], s["kind"], s["index"]), "kg-plus").tap()
    first = tid(page, "exercise-card").first
    tid(first, "swap-open").tap()
    page.wait_for_timeout(800)
    tid(page, "swap-option").first.tap()
    page.wait_for_function("() => Object.values(JSON.parse(localStorage.getItem('ilyadays-fitness:train-ui')).sessions).every((u) => Object.keys(u.drafts ?? {}).length === 0)")


def chip(reserve):
    """The effort chip for a reserve: 0 1 2 3 4–7 8+."""
    return 8 if reserve >= 8 else 4 if reserve >= 4 else max(0, reserve)


class Lifter:
    """A true one-rep max per exercise: grows with regular visits, shrinks after ten days off, ± 4 % form on the day."""

    def __init__(self, seed, life):
        self.rng, self.life, self.max, self.last = random.Random(seed), life, {}, {}

    def arrive(self, exercise, now, week):
        if exercise in self.max and exercise in self.last:
            gap = (now - self.last[exercise]) / 86400
            self.max[exercise] *= max(.65, 1 - .004 * (gap - 10)) if gap > 10 else 1 + self.life.get("grow", .011) / (1 + .03 * week)
        self.last[exercise] = now

    def reps(self, exercise, kg, target, nth, form):
        load = max(5, 82 - kg) if exercise == "assisted-pull-up" else kg
        if exercise not in self.max:
            self.max[exercise] = load * (1 + (target + 3) / 30) * self.rng.uniform(1, 1.5) * self.life.get("scale", 1) if load > 0 else target * self.rng.uniform(1.1, 1.6)
        power = self.max[exercise] * form * (1 - .025 * nth)
        return int(power if load <= 0 else max(0, 30 * (power / load - 1)))


def visit(page, base_url, lang, lifter, week, visits, first_days):
    page.goto(base_url + lang + "/fitness/train", wait_until="networkidle")
    expect(tid(page, "session")).to_have_count(0)  # a forgotten session was closed
    record = {"week": week, "at": page.evaluate("Date.now()") / 1000, "closed": tid(page, "auto-closed").count(), "done": [], "mode": ""}
    session = start_session(page)
    now = page.evaluate("Date.now()") / 1000
    record["plan"] = page.evaluate(LOADS)
    rng, life = lifter.rng, lifter.life
    for e in record["plan"]:
        lifter.arrive(e["ex"], now, week)
    form, roll, stop = rng.uniform(.96, 1.04), rng.random(), None
    if roll < life.get("short", 0):
        stop, record["mode"] = rng.randint(6, 12), "short"
    elif roll < life.get("short", 0) + life.get("forget", 0):
        stop, record["mode"] = rng.randint(6, 20), "forgotten"
    sore = life.get("sore")
    if sore and sore[0] <= week <= sore[1]:
        for e in record["plan"]:
            if "press" in e["ex"] and "leg" not in e["ex"] and "pallof" not in e["ex"]:
                page.locator(f"[data-testid='exercise-card'][data-slot-id='{e['slot']}'] .trk-act").nth(2).tap()
    nth, logged = {}, 0
    for _ in range(100):
        if not tid(page, "set-done").count():
            break
        s = current_set(page)
        row = row_at(page, s["slot"], s["kind"], s["index"])
        expect(tid(row, "set-done")).to_be_enabled()
        if s["kind"] == "working":
            ex = page.locator(f"[data-testid='exercise-card'][data-slot-id='{s['slot']}']").get_attribute("data-exercise-id")
            k = nth.get(ex, 0)
            nth[ex] = k + 1
            can = lifter.reps(ex, s["kg"], s["reps"], k, form)
            if k == 0 and s["kg"] > 0 and ex != "assisted-pull-up" and visits < first_days:
                for _ in range(4):  # the first visit: look for the starting weight
                    if lifter.reps(ex, s["kg"], s["reps"], k, form) < s["reps"] + 5:
                        break
                    tid(row, "kg-plus").tap()
                    s = current_set(page)
                can = lifter.reps(ex, s["kg"], s["reps"], k, form)
            for _ in range(max(0, s["reps"] - can)):
                tid(row, "reps-minus").tap()
            s = current_set(page)
            reserve = max(0, can - s["reps"])
            if rng.random() < life["report"]:
                row.locator(f"[data-testid='rir-choice'][data-value='{chip(reserve + life.get("bias", 0))}']").tap()
            record["done"].append((ex, s["kg"], s["reps"], reserve))
        tid(row, "set-done").tap()
        logged += 1
        page.wait_for_timeout(90)
        page.clock.fast_forward(75_000)
        if tid(page, "set-done").count() and current_set(page) == s:
            page.wait_for_timeout(800)  # the double-tap shield
        if stop and logged >= stop:
            break
    keys = [(x["slotId"], x["exerciseId"], x["kind"], x["setIndex"]) for x in stored(page, "sets").values() if x["sessionId"] == session]
    assert len(keys) == len(set(keys)) and keys, "a set was logged twice, or none"
    if record["mode"] != "forgotten":
        end_session(page, session)
        tid(page, "summary-done").tap()
    return record


def live(page, base_url, key, life=None, seed=None, weeks=WEEKS):
    plan, life = PLANS[key], life or LIVES[key]
    lang = plan.get("lang", "")
    page.clock.install(time=T0)
    build_plan(page, base_url, plan)
    lifter, days, out = Lifter(seed or key, life), plan["days"], []
    for week in range(weeks):
        change = [life[k] for k in ("goal_at", "days_at") if life.get(k) and life[k][0] == week]
        if change:
            open_program(page, base_url, lang)
            if life.get("goal_at", (None,))[0] == week:
                g = life["goal_at"][1]
                page.locator(f"[data-testid='goal-select'] [data-value='{g}'], [data-testid='goal-select'] input[value='{g}']").first.click()
            if life.get("days_at", (None,))[0] == week:
                days = life["days_at"][1]
                page.locator(f"[data-testid='days-select'] [data-value='{days}']").tap()
            tid(page, "program-save").tap()
            page.wait_for_timeout(300)
        for offset in life.get("visits", VISITS[days]):
            at = (T0 + timedelta(days=week * 7 + offset, hours=lifter.rng.uniform(-2, 9))).timestamp()
            ahead = at - page.evaluate("Date.now()") / 1000
            if ahead > 0:
                page.clock.fast_forward(int(ahead * 1000))
            if week in life.get("away", []) or lifter.rng.random() > life["attend"]:
                continue
            out.append(visit(page, base_url, lang, lifter, week, len(out), plan["days"]))
    page.goto(base_url + lang + "/fitness/progress", wait_until="networkidle")
    no_horizontal_scroll(page)
    told = [a for a in stored(page, "adjustments").values() if a["source"] == "engine"]
    finished = [s for s in stored(page, "sessions").values() if s["status"] == "finished"]
    assert {a["input"]["sessionId"] for a in told} >= {s["id"] for s in finished}, "a session without its recommendations"
    dump = os.environ.get("FITNESS_E2E_DUMP")
    if dump:
        Path(dump).mkdir(parents=True, exist_ok=True)
        (Path(dump) / f"{life.get('id', key)}.json").write_text(json.dumps(out, ensure_ascii=False))
    return out


def check_sane(records):
    """What must hold in any life: no token sets, one story per card, a forgotten session closed on the next visit, and
    no load so light that the lifter has 15+ reps to spare for a whole month of reported visits."""
    for a, b in zip(records, records[1:]):
        if a["mode"] == "forgotten":
            assert b["closed"] == 1, f"week {b['week']}: no notice about the forgotten session"
    for r in records:
        for e in r["plan"]:
            assert not ("since you last did" in e["notes"] and "First time" in e["notes"]), e
            for kg, reps in e["sets"]:
                assert kg >= 0 and reps >= 3, f"week {r['week']} {e['ex']}: {kg} kg x {reps}"
    assert records and sum(len(r["done"]) for r in records) > 0


@months
@pytest.mark.parametrize("key", PLANS)
def test_months_of_training(phone, base_url, key):
    page, probe = phone
    fake(page)
    records = live(page, base_url, key)
    check_sane(records)
    assert len(active_program(page)["days"]) == LIVES[key].get("days_at", (0, PLANS[key]["days"]))[1] or WEEKS <= 10
    probe.assert_clean()


@months
@pytest.mark.parametrize("report", [0, 1])
def test_months_with_and_without_effort_reports(phone, base_url, report):
    """The one-tap lifter progresses; the lifter who reports every set gets a load that is not absurdly light."""
    page, probe = phone
    fake(page)
    records = live(page, base_url, "strength", dict(attend=1, report=report), seed=7)
    check_sane(records)
    by = {}
    for r in records:
        for ex, kg, reps, _ in r["done"]:
            by.setdefault(ex, []).append((kg, reps))
    loaded = {ex: v for ex, v in by.items() if len(v) > 8 and v[0][0] > 0 and ex != "assisted-pull-up"}
    better = [ex for ex, v in loaded.items() if max(k * (1 + n / 30) for k, n in v[-3:]) > min(k * (1 + n / 30) for k, n in v[:3])]
    assert loaded and len(better) >= .8 * len(loaded), by
    probe.assert_clean()


@months
def test_months_of_flat_strength_stay_liftable(phone, base_url):
    """A lifter who gets no stronger and reports every set: the faster rules must not push past what they can do."""
    page, probe = phone
    fake(page)
    records = live(page, base_url, "hypertrophy", dict(attend=1, report=1, grow=0), seed=11)
    check_sane(records)
    later = [r for r in records if r["week"] >= 2]
    sets = [d for r in later for d in r["done"] if d[1] > 0]
    assert sets
    failed = [d for d in sets if d[2] < 5]  # far under any range of this plan
    assert len(failed) <= .02 * len(sets), failed[:10]
    probe.assert_clean()


@months
@pytest.mark.parametrize("name", OTHERS)
def test_months_of_other_people(phone, base_url, name):
    """Long absences, odd cadences, very weak and very strong lifters, people who misjudge their effort."""
    page, probe = phone
    fake(page)
    plan, weeks, life = OTHERS[name]
    records = live(page, base_url, plan, {**life, "id": name}, seed=name, weeks=weeks)
    check_sane(records)
    # back from a month or more, nothing is planned heavier than it was before
    last = {}
    for r in records:
        for e in r["plan"]:
            if not e["sets"]:
                continue
            kg, seen = e["sets"][0][0], last.get(e["ex"])
            if seen and (r["at"] - seen[0]) / 86400 >= 29:
                assert kg <= seen[1] or e["ex"] == "assisted-pull-up", f"{name}: {e['ex']} {seen[1]} -> {kg} kg after the break"
        for ex, kg, _, _ in r["done"]:
            last[ex] = (r["at"], kg)
    # a suggested step up is liftable (people who misjudge their effort aside), and an odd cadence does not ratchet the
    # load down for someone who keeps meeting the targets
    if "bias" not in life:
        tops, bad, steps = {}, [], 0
        for i, r in enumerate(records):
            first = {}
            for ex, kg, reps, spare in r["done"]:
                first.setdefault(ex, (kg, reps, spare))
            for ex, (kg, reps, spare) in first.items():
                if ex in tops and kg > tops[ex] > 0 and ex != "assisted-pull-up" and i > 6:
                    steps += 1
                    bad += [(r["week"], ex, tops[ex], kg, reps)] if reps < 2 else []
                tops[ex] = kg
        assert len(bad) <= max(1, .1 * steps), bad
    if name == "very-strong":
        late = sorted(spare for r in records if r["week"] >= 6 for _, kg, _, spare in r["done"] if kg > 0)
        assert late[len(late) // 2] <= 12, late[len(late) // 2]
    if name in ("on-and-off", "once-a-fortnight"):
        loads = [(kg, spare) for r in records for ex, kg, _, spare in r["done"] if ex == "trap-bar-deadlift"]
        assert loads[-1][1] <= 15 and loads[-1][0] >= .6 * loads[0][0], loads
    probe.assert_clean()


@pytest.mark.parametrize("lang", ["", "/ru"])
def test_done_is_never_left_behind_the_session_bar(small_phone, base_url, lang):
    """After each logged set the next Done button settles above the sticky bar."""
    page, _ = small_phone
    fake(page)
    page.set_viewport_size({"width": 360, "height": 800})
    page.goto(f"{base_url}{lang}/fitness/train", wait_until="networkidle")
    start_session(page)
    for _ in range(3):
        log_until_working(page, 1)
        page.wait_for_timeout(1800)
        box = tid(page, "set-done").first.bounding_box()
        bar = page.evaluate("() => document.querySelector('.trk-bar').getBoundingClientRect().top")
        assert box["y"] >= 0 and box["y"] + box["height"] <= bar, (box, bar)
