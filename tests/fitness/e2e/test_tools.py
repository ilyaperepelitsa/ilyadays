"""/fitness/tools: the load calculator answers like the engine and stays usable on a small phone."""
from conftest import FakeBackend, no_horizontal_scroll


def _e1rm(page):
    return float(page.get_attribute("[data-testid=calc-e1rm]", "data-kg"))


def test_load_table_follows_the_inputs(small_phone, base_url):
    page, probe = small_phone
    FakeBackend(page)
    page.goto(base_url + "/fitness/tools", wait_until="networkidle")
    page.select_option("[data-testid=calc-exercise]", "machine-chest-press")
    page.fill("[data-testid=calc-kg]", "50")
    page.fill("[data-testid=calc-reps]", "8")
    page.locator("[aria-labelledby=calc-rir-label] button[data-value='0']").tap()
    # 50 kg × 8 to failure: mean of Epley (63.33) and Brzycki (62.07) = 62.70 kg
    page.wait_for_function("() => document.querySelector('[data-testid=calc-e1rm]')?.dataset.kg === '62.7'")
    assert abs(_e1rm(page) - 62.7) < 0.01
    before = _e1rm(page)
    page.tap("[data-testid=calc-kg-plus]")  # +5 kg, the machine's step
    page.wait_for_function(f"() => Number(document.querySelector('[data-testid=calc-e1rm]').dataset.kg) > {before}")
    cells = page.locator("[data-testid=calc-table] tbody td").all_inner_texts()
    assert cells and all(c in ("—",) or float(c.replace(",", ".")) % 5 == 0 for c in cells), cells
    no_horizontal_scroll(page)
    probe.assert_clean()


def test_assisted_machine_uses_body_weight(phone, base_url):
    page, probe = phone
    FakeBackend(page)
    page.goto(base_url + "/fitness/tools", wait_until="networkidle")
    page.select_option("[data-testid=calc-exercise]", "assisted-pull-up")
    if page.locator("[data-testid=calc-bodyweight]").count():
        page.fill("[data-testid=calc-bodyweight]", "80")
    page.fill("[data-testid=calc-kg]", "30")
    page.fill("[data-testid=calc-reps]", "8")
    page.locator("[aria-labelledby=calc-rir-label] button[data-value='1']").tap()
    # lifted part 80 − 30 = 50 kg × (8 + 1) → (Epley 65 + Brzycki 64.29) / 2 = 64.64 kg
    page.wait_for_function("() => Math.abs(Number(document.querySelector('[data-testid=calc-e1rm]')?.dataset.kg) - 64.64) < 0.02")
    probe.assert_clean()


def test_plates_per_side(phone, base_url):
    page, probe = phone
    FakeBackend(page)
    page.goto(base_url + "/ru/fitness/tools", wait_until="networkidle")
    page.fill("[data-testid=plates-total]", "100")
    page.wait_for_function("() => document.querySelector('[data-testid=plates-result]')?.dataset.loaded === '100'")
    plates = page.locator("[data-testid=plates-result] li").all_inner_texts()
    assert plates == ["25", "15"], plates
    page.fill("[data-testid=plates-total]", "15")
    page.wait_for_selector("[data-testid=plates-result]", state="detached")
    probe.assert_clean()


def test_a_field_label_focuses_the_field_and_rir_fits_one_row(small_phone, base_url):
    """A label that wrapped the stepper passed its tap to the − button inside it: a tap on "Weight" lowered the weight."""
    page, probe = small_phone
    FakeBackend(page)
    page.goto(base_url + "/ru/fitness/tools", wait_until="networkidle")
    for testid in ("calc-kg", "calc-reps"):
        field = page.locator(f"[data-testid={testid}]")
        before = field.input_value()
        page.locator(f"label[for='{field.get_attribute('id')}']").tap()
        assert field.input_value() == before, testid
        assert page.evaluate("document.activeElement.dataset.testid") == testid
    # the five RIR choices share one row at 360 px, Russian included ("4" used to wrap onto a row of its own)
    tops = page.evaluate("() => [...document.querySelectorAll('[aria-labelledby=calc-rir-label] button')].map((b) => b.offsetTop)")
    assert len(tops) == 5 and len(set(tops)) == 1, tops
    probe.assert_clean()
