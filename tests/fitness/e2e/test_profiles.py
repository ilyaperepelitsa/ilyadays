"""Personal onboarding, persistent plan exclusions, circumference logs and account-boundary drafts."""
import base64
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import expect
from conftest import FakeBackend, OWNER_ID, no_horizontal_scroll
from test_gym_session import block_realtime, stored, tid

UID = "33333333-3333-4333-8333-333333333333"


def choice(page, group, value):
    return tid(page, group).locator(f"[data-value='{value}']")


class PersonalBackend(FakeBackend):
    def __init__(self, page):
        self.profile = None
        self.signed_in = True
        super().__init__(page)
        block_realtime(page)
        self.state = "public"
        page.context.route(re.compile(r".*/auth/v1/.*"), self.auth)
        env = (Path(__file__).resolve().parents[3] / ".env.local").read_text()
        url = re.search(r"^NEXT_PUBLIC_SUPABASE_URL=['\"]?([^'\"\s]+)", env, re.M).group(1)
        host = urlparse(url).hostname
        enc = lambda x: base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip("=")
        token = enc({"alg": "HS256", "typ": "JWT"}) + "." + enc({"sub": UID, "exp": 2100000000, "role": "authenticated"}) + ".test"
        session = {"access_token": token, "refresh_token": "test-refresh", "token_type": "bearer", "expires_at": 2100000000, "expires_in": 3600000,
                   "user": {"id": UID, "email": "athlete@example.test", "aud": "authenticated", "role": "authenticated", "user_metadata": {"full_name": "New athlete"}}}
        page.add_init_script(f"if(!localStorage.getItem('test-auth-seeded')){{localStorage.setItem({json.dumps('ilyadays-auth:'+host)},{json.dumps(json.dumps(session))});localStorage.setItem('test-auth-seeded','yes');}}")


    def auth(self, route):
        if "logout" in route.request.url:
            self.signed_in = False
            return route.fulfill(status=204, body="")
        return route.fulfill(status=200, content_type="application/json", body="{}")

    def _handle(self, route):
        req = route.request
        name = re.search(r"/rest/v1/(?:rpc/)?([a-z_]+)", req.url).group(1)
        self.calls.append(f"{req.method} {req.url}")
        def reply(data, status=200):
            return route.fulfill(status=status, content_type="application/json", body=json.dumps(data))
        if name == "is_admin": return reply(False)
        if name == "fitness_can_write": return reply(self.signed_in and self.profile is not None)
        if name == "fitness_owner_id": return reply(OWNER_ID)
        if name == "fitness_register_profile":
            args = req.post_data_json
            assert args["expected_user_id"] == UID
            self.profile = {"user_id": UID, "display_name": args["display_name"], "is_owner": False, "is_public": False, "settings": {}, "updated_at": "2026-11-09T14:00:00.000Z"}
            return reply({**self.profile, "created": True})
        if name == "fitness_update_profile":
            args = req.post_data_json
            self.profile.update(display_name=args["display_name"], is_public=args["is_public"])
            return reply(self.profile)
        if req.method in ("POST", "PATCH", "DELETE"):
            self.writes.append(f"{req.method} {req.url}")
            data = req.post_data_json if req.post_data else None
            if name == "fitness_profiles" and req.method == "PATCH":
                self.profile.update(data)
                return reply(self.profile)
            if req.method == "POST":
                rows = data if isinstance(data, list) else [data]
                by_id = {r.get("id", r.get("exercise_id")): r for r in self.rows.get(name, [])}
                for row in rows: by_id[row.get("id", row.get("exercise_id"))] = row
                self.rows[name] = list(by_id.values())
                return reply(rows, 201)
            return reply([])
        if name == "fitness_profiles":
            query = parse_qs(urlparse(req.url).query)
            own = query.get("user_id") == ["eq." + UID]
            rows = [self.profile] if own and self.profile else []
        else: rows = self.rows.get(name, []) if self.signed_in else []
        single = "application/vnd.pgrst.object" in req.headers.get("accept", "")
        return reply((rows[0] if rows else None) if single else rows)


def test_private_registration_preserves_submitted_choices_and_builds_personal_plan(phone, base_url):
    page, probe = phone
    backend = PersonalBackend(page)
    page.goto(base_url + "/fitness/profile")
    expect(tid(page, "profile-save")).to_be_enabled()
    tid(page, "profile-name").fill("My personal training")
    tid(page, "profile-weight").fill("85.5")
    tid(page, "profile-goal").locator("input[value='strength']").check()
    tid(page, "profile-secondary").locator("[data-value=hypertrophy]").click()
    tid(page, "profile-days").select_option("2")
    tid(page, "profile-scope").select_option("upper")
    tid(page, "profile-save").click()
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "synced")
    expect(tid(page, "profile-goal")).to_have_attribute("data-value", "strength")
    expect(tid(page, "profile-weight")).to_have_value("85.5")
    expect(tid(page, "profile-name")).to_have_value("My personal training")
    expect(tid(page, "profile-secondary").locator("[data-value=hypertrophy]")).to_have_attribute("aria-pressed", "true")
    expect(tid(page, "profile-public")).not_to_be_checked()
    expect(page.get_by_text("Profile saved. Your plan and training history are ready.", exact=True)).to_be_visible()
    programs = stored(page, "programs")
    active = next(p for p in programs.values() if p.get("active") is not False)
    assert active["goal"] == "strength" and active["daysPerWeek"] == 2
    assert active["preferences"]["bodyScope"] == "upper"
    assert "hypertrophy" in active["preferences"]["secondaryGoals"]
    assert backend.profile["is_public"] is False and backend.profile["is_owner"] is False
    page.reload()
    expect(tid(page, "profile-goal")).to_have_attribute("data-value", "strength")
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_profile_goal_keyboard_and_mobile_plan_preview(phone, fake_backend, base_url):
    page, probe = phone
    page.goto(base_url + "/fitness/profile", wait_until="networkidle")
    goals = tid(page, "profile-goal")
    goals.locator("input[value='recomp']").focus()
    page.keyboard.press("ArrowRight")
    expect(goals).to_have_attribute("data-value", "endurance")
    tid(page, "profile-days").select_option("2")
    bar = page.locator(".fprofile-mobile-preview")
    expect(bar).to_contain_text("2 days/week")
    bar.locator("button").click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    expect(dialog.locator(".fprofile-preview-days > section")).to_have_count(2)
    expect(dialog.locator("img").first).to_be_visible()
    page.wait_for_function("() => document.querySelector('dialog img')?.naturalWidth > 0")
    page.keyboard.press("Escape")
    expect(dialog).not_to_be_visible()
    expect(bar.locator("button")).to_be_focused()
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_desktop_profile_and_plan_keep_real_exercise_pictures_visible(desktop_page, base_url):
    page, probe = desktop_page
    FakeBackend(page)
    page.goto(base_url + "/fitness/profile", wait_until="networkidle")
    preview = page.locator("aside.fprofile-preview")
    expect(preview).to_be_visible()
    expect(preview.locator(".fprofile-preview-days > section")).to_have_count(3)
    expect(preview.locator("img").first).to_be_visible()
    page.goto(base_url + "/fitness/program", wait_until="networkidle")
    expect(tid(page, "goal-select")).to_be_visible()
    row = tid(page, "slot-row").first
    expect(row.locator("img")).to_be_visible()
    assert row.bounding_box()["y"] < 800, "exercise editing must be visible in the first desktop viewport"
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_circumferences_are_independent_dated_records_with_separate_sides(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    page.goto(base_url + "/fitness/progress")
    tid(page, "measurement-waist").fill("88.2")
    tid(page, "measurement-left-biceps").fill("33.1")
    tid(page, "measurement-right-biceps").fill("34")
    tid(page, "measurement-save").click()
    expect(tid(page, "measurement-entry")).to_have_count(1)
    row = next(iter(stored(page, "measurements").values()))
    assert row["values"] == {"waist": 88.2, "left-biceps": 33.1, "right-biceps": 34}
    assert not stored(page, "bodyweight"), "circumference-only record never invents a scale weight"
    page.reload()
    expect(tid(page, "measurement-entry")).to_have_count(1)
    tid(page, "measurement-waist").fill("87.4")
    tid(page, "measurement-save").click()
    expect(tid(page, "measurement-entry")).to_have_count(2)
    expect(tid(page, "measurement-change")).to_be_visible()
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_private_unsaved_drafts_are_removed_when_signing_out(phone, base_url):
    page, probe = phone
    backend = PersonalBackend(page)
    page.goto(base_url + "/fitness/profile")
    tid(page, "profile-name").fill("Private athlete")
    tid(page, "profile-save").click()
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "synced")
    page.goto(base_url + "/fitness/program")
    tid(page, "program-settings-toggle").click()
    tid(page, "plan-name").fill("PRIVATE DRAFT SHOULD DISAPPEAR")
    tid(page, "plan-name").blur()
    page.get_by_role("button", name="Sign out", exact=True).click()
    expect(tid(page, "mode-note")).to_have_attribute("data-mode", "viewer")
    expect(tid(page, "plan-name")).not_to_have_value("PRIVATE DRAFT SHOULD DISAPPEAR")
    assert backend.signed_in is False
    probe.assert_clean()


def test_constructor_persists_no_legs_supporting_goals_and_pivot_history(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    page.goto(base_url + "/fitness/program")
    tid(page, "program-settings-toggle").click()
    page.locator("[data-testid='plan-scope'] [data-value='upper']").click()
    tid(page, "plan-secondary").locator("[data-value=hypertrophy]").click()
    tid(page, "plan-name").fill("Upper body personal plan")
    tid(page, "plan-name").blur()
    tid(page, "pivot-reason").fill("No leg training; focus shoulders and arms")
    tid(page, "pivot-reason").blur()
    tid(page, "program-save").click()
    page.reload()
    tid(page, "program-settings-toggle").click()
    expect(page.locator("[data-testid='plan-scope'] [data-value='upper']")).to_have_attribute("aria-pressed", "true")
    expect(tid(page, "plan-secondary").locator("[data-value=hypertrophy]")).to_have_attribute("aria-pressed", "true")
    page.locator("[data-testid='goal-select'] [data-value='strength']").click()
    page.locator("[data-testid='days-select'] [data-value='4']").click()
    tid(page, "program-save").click()
    active = next(p for p in stored(page, "programs").values() if p.get("active") is not False)
    assert active["goal"] == "strength" and active["daysPerWeek"] == 4
    assert set(["quads", "hamstrings", "adductors", "glutes", "calves"]) <= set(active["preferences"]["excludedGroups"])
    assert not any(s["exerciseId"] in ("farmers-carry", "leg-press-45", "dumbbell-rdl", "hip-adduction-machine") for d in active["days"] for s in d["slots"])
    assert any(p.get("active") is False for p in stored(page, "programs").values()), "previous plan archived"
    assert stored(page, "adjustments"), "pivot recorded in plan history"
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_empty_custom_days_cannot_be_saved(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "missing"
    page.goto(base_url + "/fitness/program")
    tid(page, "program-settings-toggle").click()
    button = tid(page, "plan-custom")
    button.locator("xpath=ancestor::details[1]/summary").click()
    button.click()
    expect(tid(page, "empty-plan-days")).to_be_visible()
    expect(tid(page, "program-save")).to_be_disabled()
    assert not stored(page, "programs"), "an empty draft was not persisted"
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_easy_set_guidance_uses_reported_effort_and_keeps_the_same_weight(phone, fake_backend, base_url):
    from test_gym_session import card, current_set, log_current, row_at, start_session
    page, probe = phone
    fake_backend.state = "missing"
    page.goto(base_url + "/fitness/train")
    session_id = start_session(page)
    while current_set(page)["kind"] == "warmup":
        log_current(page)
    first = current_set(page)
    row = row_at(page, first["slot"], first["kind"], first["index"])
    guide = tid(row, "set-effort-guide")
    guide.locator("summary").click()
    expect(guide).to_contain_text("13")
    row.locator("[data-testid='rir-choice'][data-value='4']").click()
    expect(tid(row, "set-effort-feedback")).to_be_visible()
    log_current(page)
    pending = card(page, first["slot"]).locator("[data-kind='working'][data-state='planned']").first
    expect(pending).to_have_attribute("data-kg", str(first["kg"]))
    expect(pending).to_have_attribute("data-reps", str(first["reps"] + 1))
    actual = next(s for s in stored(page, "sets").values() if s["sessionId"] == session_id and s["kind"] == "working")
    assert actual["plannedReps"] == first["reps"]
    assert actual["prescription"]["rirReported"] is True
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_fitness_without_a_published_owner_guides_visitors_to_their_own_profile(phone, fake_backend, base_url):
    page, probe = phone
    fake_backend.state = "public"
    page.context.route("**/rest/v1/rpc/fitness_owner_id", lambda route: route.fulfill(status=200, content_type="application/json", body="null"))
    page.goto(base_url + "/fitness")
    welcome = tid(page, "fitness-welcome")
    expect(welcome).to_be_visible()
    expect(welcome.get_by_role("link", name="Create your profile", exact=True)).to_have_attribute("href", "/fitness/profile")
    expect(tid(page, "next-session")).to_have_count(0)
    expect(tid(page, "start-session")).to_have_count(0)
    expect(tid(page, "mode-note")).to_have_count(0)
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_explorer_multiple_goals_muscles_handoff_and_profile_persistence(phone, base_url):
    page, probe = phone
    PersonalBackend(page)
    page.goto(base_url + "/fitness/exercises?mf=0")
    tid(page, "explorer-muscle-options").locator("summary").click()
    choice(page, "explorer-muscles", "shoulders").click()
    choice(page, "explorer-muscles", "biceps").click()
    tid(page, "explorer-goal-options").locator("summary").click()
    choice(page, "explorer-goals", "strength").click()
    choice(page, "explorer-goals", "hypertrophy").click()
    choice(page, "explorer-goals", "maintenance").click()
    choice(page, "explorer-goals", "endurance").click()
    page.reload()
    tid(page, "explorer-muscle-options").locator("summary").click()
    tid(page, "explorer-goal-options").locator("summary").click()
    for value in ["shoulders", "biceps"]:
        expect(choice(page, "explorer-muscles", value)).to_have_attribute("aria-pressed", "true")
    for value in ["strength", "hypertrophy", "maintenance", "endurance"]:
        expect(choice(page, "explorer-goals", value)).to_have_attribute("aria-pressed", "true")
    tid(page, "explorer-use-choices").click()
    expect(tid(page, "profile-goal")).to_have_attribute("data-value", "strength")
    expect(choice(page, "profile-focus", "shoulders")).to_have_attribute("aria-pressed", "true")
    expect(choice(page, "profile-focus", "biceps")).to_have_attribute("aria-pressed", "true")
    tid(page, "profile-save").click()
    expect(page.get_by_text("Profile saved. Your plan and training history are ready.", exact=True)).to_be_visible()
    active = next(p for p in stored(page, "programs").values() if p.get("active") is not False)
    assert active["preferences"]["focusGroups"] == ["shoulders", "biceps"]
    assert active["preferences"]["secondaryGoals"] == ["hypertrophy", "maintenance", "endurance"]
    page.goto(base_url + "/fitness/profile")
    expect(choice(page, "profile-focus", "biceps")).to_have_attribute("aria-pressed", "true")
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_shadcn_multiselect_keyboard_and_excluded_focus_conflict(phone, base_url):
    page, probe = phone
    PersonalBackend(page)
    page.goto(base_url + "/fitness/profile")
    tid(page, "profile-save").click()
    expect(page.get_by_text("Profile saved. Your plan and training history are ready.", exact=True)).to_be_visible()
    page.goto(base_url + "/fitness/profile?from=explorer&goals=strength&focus=quads,shoulders")
    expect(tid(page, "profile-scope")).to_have_value("upper")
    expect(choice(page, "profile-focus", "quads")).to_have_attribute("aria-pressed", "true")
    expect(choice(page, "profile-focus", "quads")).to_be_enabled()
    tid(page, "profile-save").click()
    expect(tid(page, "profile-panel").get_by_role("alert").last).to_contain_text("excluded")
    choice(page, "profile-focus", "quads").click()
    expect(choice(page, "profile-focus", "quads")).to_be_disabled()
    shoulder = choice(page, "profile-focus", "shoulders")
    shoulder.focus()
    page.keyboard.press("ArrowRight")
    expect(choice(page, "profile-focus", "biceps")).to_be_focused()
    page.keyboard.press("Space")
    expect(choice(page, "profile-focus", "biceps")).to_have_attribute("aria-pressed", "true")
    tid(page, "profile-save").click()
    expect(page.get_by_text("Profile saved. Your plan and training history are ready.", exact=True)).to_be_visible()
    no_horizontal_scroll(page)
    probe.assert_clean()
