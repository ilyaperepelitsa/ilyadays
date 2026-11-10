"""Real browser → local Next proxy → FastAPI → SQLite; isolated synthetic data only."""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
from urllib.request import urlopen
import shutil

import pytest
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[3]
BASE = 'http://127.0.0.1:3152'


@pytest.fixture(scope='session')
def service(tmp_path_factory):
    for port in [3152, 8767]:
        with socket.socket() as sock:
            assert sock.connect_ex(('127.0.0.1', port)) != 0, f'Test port {port} is in use; tests will not stop another process.'
    data = tmp_path_factory.mktemp('aurelius-private-test')
    log = (data / 'service.log').open('w')
    process = subprocess.Popen(['node', 'scripts/aurelius-dev.mjs'], cwd=ROOT, env={**os.environ, 'AURELIUS_DATA_DIR': str(data), 'AURELIUS_UI_PORT': '3152', 'AURELIUS_API_PORT': '8767', 'AURELIUS_TEST': '1'}, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if process.poll() is not None:
                pytest.fail((data / 'service.log').read_text()[-3000:])
            try:
                with urlopen(BASE + '/stoicism', timeout=3) as response:
                    if response.status == 200:
                        break
            except (OSError, TimeoutError):
                time.sleep(.3)
        else:
            pytest.fail('Aurelius test server did not start')
        seed = data / 'fresh.sqlite3'
        shutil.copyfile(data / 'aurelius.sqlite3', seed)
        yield data, seed
    finally:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
        log.close()


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def page(browser, service):
    data, seed = service
    # Only the test-created temp database is restored between scenarios; no reset API exists.
    shutil.copyfile(seed, data / 'aurelius.sqlite3')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.route('**/_vercel/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    p = context.new_page()
    errors = []
    p.on('pageerror', lambda error: errors.append(str(error)))
    p.goto(BASE + '/stoicism', wait_until='domcontentloaded')
    expect(p.get_by_role('textbox', name='Conclusion text', exact=True)).to_be_visible(timeout=30000)
    p.get_by_role('combobox',name='Selected teaching').select_option('c1')
    yield p
    assert not errors, errors
    assert context.cookies() == []
    assert p.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    context.close()


def state(page):
    response = page.request.get(BASE + '/api/aurelius/state')
    assert response.ok
    return response.json()


def wait_saved(page):
    expect(page.locator('.au-live')).to_contain_text('Saved locally')


def test_real_persistence_review_and_stale_revision(page):
    for button in page.get_by_role('button', name='Review link', exact=True).all():
        button.click()
        wait_saved(page)
    page.get_by_role('textbox', name='Conclusion review note').fill('Checked all three exact spans and the joint qualification.')
    page.get_by_role('button', name='Approve after review').click()
    wait_saved(page)
    expect(page.get_by_test_id('meaning-card')).to_have_attribute('data-status', 'approved')
    previous = state(page)
    box = page.get_by_role('textbox', name='Conclusion text', exact=True)
    box.fill('Always remain silent, even when an objection is fair.')
    expect(page.get_by_test_id('meaning-card')).to_have_attribute('data-status', 'stale')
    page.get_by_role('button', name='Save revision', exact=True).click()
    wait_saved(page)
    after = state(page)
    current = after['conclusions'][0]['current']
    assert current != previous['conclusions'][0]['current']
    assert after['assessments']['c1:r1']['state'] == 'approved'
    assert after['assessments'][current]['state'] == 'stale'
    assert after['assessments']['e1:r1']['state'] == 'stale'
    assert all(l['review_state'] == 'stale' for l in after['links'] if l['target_revision'] == current)
    page.reload(wait_until='domcontentloaded')
    expect(page.get_by_role('textbox', name='Conclusion text', exact=True)).to_have_text('Always remain silent, even when an objection is fair.')
    page.get_by_role('button', name='Review history', exact=True).click()
    expect(page.locator('.au-table-scroll')).to_contain_text('c1:r1')
    expect(page.locator('.au-table-scroll')).to_contain_text('approved')


def test_exact_selection_manual_link_reverse_click_and_archive(page):
    page.get_by_text('Create a manual teaching', exact=True).click()
    page.get_by_role('textbox', name='New teaching title').fill('A deliberately narrow draft')
    page.get_by_role('textbox', name='New teaching statement').fill('A fair answer may be required.')
    page.get_by_role('button', name='Create draft', exact=True).click()
    wait_saved(page)
    page.get_by_role('searchbox', name='Search source passages').fill('B.2')
    source = page.locator('[data-passage="demo-p2"] .au-source-text')
    source.evaluate("""node => { const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);const text=walker.nextNode();const range=document.createRange();range.setStart(text,0);range.setEnd(text,Math.min(9,text.length));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);node.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); }""")
    expect(page.locator('.au-selection-tray')).to_contain_text('New exact selection')
    page.get_by_role('textbox', name='New evidence justification').fill('The opening phrase names the situation, not a universal obligation.')
    page.get_by_role('combobox', name='New evidence relation').select_option('illustrates')
    page.get_by_role('button', name='Attach to selected meaning').click()
    wait_saved(page)
    w = state(page)
    added = w['links'][-1]
    span = next(s for s in w['spans'] if s['id'] == added['source_span'])
    passage = next(p for p in w['passages'] if p['revision_id'] == span['passage_revision'])
    assert passage['text'][span['start']:span['end']] == span['exact']
    assert added['relation'] == 'illustrates'
    page.locator('.au-evidence-row').get_by_role('button', name='Demo B.2 ↗').click()
    expect(page.get_by_role('region', name='Selected source uses')).to_contain_text('A deliberately narrow draft')
    page.get_by_role('button', name='Remove link', exact=True).click()
    wait_saved(page)
    assert state(page)['links'][-1]['active'] is False
    expect(page.locator('.au-evidence')).to_contain_text('No support attached')


def test_stored_arrows_selection_scrolling_and_keyboard_resizing(page):
    visible_spans = page.get_by_test_id('sources-scroll').evaluate("pane => [...pane.querySelectorAll('[data-source-anchor]')].filter(el => {const r=el.getBoundingClientRect(),p=pane.getBoundingClientRect();return r.bottom>p.top&&r.top<p.bottom;}).map(el=>el.dataset.sourceAnchor)")
    expected_links = {link['id'] for link in state(page)['links'] if link['source_span'] in visible_spans and link['active']}
    expect(page.locator('[data-evidence-link]')).to_have_count(len(expected_links))
    assert expected_links and set(page.locator('[data-evidence-link]').evaluate_all("els => els.map(el=>el.dataset.evidenceLink)")) == expected_links
    source = page.locator('[data-source-anchor="span-1"]').first
    source.click()
    expect(page.locator('[data-evidence-link]')).to_have_count(1)
    assert page.locator('[data-evidence-link]').get_attribute('data-evidence-link') == 'link-1'
    before = page.locator('[data-evidence-link]').get_attribute('d')
    separator = page.get_by_role('separator', name='Resize sources and meaning')
    separator.focus()
    page.keyboard.press('ArrowRight')
    expect(separator).to_have_attribute('aria-valuenow', '49')
    page.wait_for_function("previous => document.querySelector('[data-evidence-link]').getAttribute('d') !== previous", arg=before)
    page.get_by_test_id('sources-scroll').evaluate('el => el.scrollTop=el.scrollHeight')
    expect(page.locator('[data-evidence-link]')).to_have_count(0)
    page.get_by_test_id('sources-scroll').evaluate('el => el.scrollTop=0')
    expect(page.locator('[data-evidence-link]')).to_have_count(1)
    page.get_by_role('combobox', name='Color mode').select_option('plain')
    expect(page.get_by_test_id('evidence-connectors')).to_have_count(0)
    page.get_by_role('combobox', name='Color mode').select_option('theme')
    expect(page.locator('.au-workspace')).to_have_attribute('data-mode','theme')


def test_expression_unsupported_text_and_stable_blocks_across_split_undo_save(page):
    page.get_by_role('button', name='Add expression pane').click()
    page.get_by_role('combobox', name='Expression variant').select_option('e2')
    expect(page.get_by_test_id('expression-card')).to_have_attribute('data-status', 'unsupported')
    expect(page.locator('.au-expression .au-unmapped')).to_contain_text('never feel anger')
    page.get_by_role('textbox', name='Expression review note').fill('This adds an unsupported universal guarantee.')
    page.get_by_test_id('expression-card').get_by_role('button', name='Approve after review').click()
    expect(page.locator('.au-live')).to_contain_text('Unsupported prose')
    box = page.get_by_role('textbox', name='Expression text', exact=True)
    box.click()
    page.keyboard.press('ControlOrMeta+End')
    page.keyboard.press('Enter')
    page.keyboard.insert_text('An additional promise needs fresh support. 🏛️ e\u0301')
    page.get_by_test_id('expression-card').get_by_role('button', name='Undo', exact=True).click()
    page.get_by_test_id('expression-card').get_by_role('button', name='Redo', exact=True).click()
    page.get_by_test_id('expression-card').get_by_role('button', name='Save revision', exact=True).click()
    wait_saved(page)
    w = state(page)
    rid = w['expressions'][1]['current']
    doc = next(r['doc'] for r in w['revisions'] if r['id'] == rid)
    ids = [block['attrs']['id'] for block in doc['content']]
    assert len(ids) == len(set(ids)) and len(ids) >= 2
    assert w['assessments'][rid]['state'] == 'stale'
    page.reload(wait_until='domcontentloaded')
    expect(page.get_by_role('textbox', name='Conclusion text', exact=True)).to_be_visible()
    assert next(r['doc'] for r in state(page)['revisions'] if r['id'] == rid) == doc


def test_edition_corpus_lock_and_private_export(page):
    page.get_by_role('button', name='Lock decision', exact=True).click()
    wait_saved(page)
    expect(page.get_by_role('textbox', name='Conclusion text', exact=True)).to_have_attribute('contenteditable','false')
    page.get_by_role('button', name='Unlock decision', exact=True).click()
    wait_saved(page)
    page.get_by_role('button', name='Corpus inspection', exact=True).click()
    expect(page.locator('tbody tr')).to_have_count(len(state(page)['passages']))
    page.get_by_role('button', name='Edition & import', exact=True).last.click()
    expect(page.locator('.au-section')).to_contain_text('9781588361738')
    expect(page.locator('.au-section')).to_contain_text('Adobe DRM')
    expect(page.locator('.au-section')).to_contain_text('explicit import/external-processing approval and budget')
    with page.expect_download() as download:
        page.get_by_role('button', name='Export demo project').click()
    exported = json.loads(Path(download.value.path()).read_text())
    assert exported['manifest']['not_a_translation'] is True
    assert exported['manifest']['model_runs'] == []
    assert exported['workspace']['corpus_kind'] == 'synthetic'


def test_edit_default_before_selecting_any_variant_keeps_reload_usable(page):
    page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('aurelius-')).forEach(k=>localStorage.removeItem(k))")
    page.reload(wait_until='domcontentloaded')
    editor=page.get_by_role('textbox',name='Conclusion text',exact=True)
    expect(editor).to_be_visible()
    editor.fill('The default teaching was edited before selecting an expression.')
    page.get_by_test_id('meaning-card').get_by_role('button',name='Save revision',exact=True).click()
    wait_saved(page)
    page.reload(wait_until='domcontentloaded')
    expect(editor).to_have_text('The default teaching was edited before selecting an expression.')
    page.get_by_role('button',name='Add expression pane',exact=True).click()
    expect(page.get_by_test_id('expression-card')).to_have_attribute('data-status','stale')


@pytest.mark.parametrize('width,lang,scheme', [(360,'en','light'),(390,'ru','dark'),(768,'en','dark')])
def test_responsive_navigation_and_three_panes(page,width,lang,scheme):
    page.set_viewport_size({'width':width,'height':900})
    page.emulate_media(color_scheme=scheme)
    page.goto(BASE+('/ru' if lang=='ru' else '')+'/stoicism',wait_until='domcontentloaded')
    expect(page.get_by_role('textbox',name='Conclusion text',exact=True)).to_be_visible()
    active = page.locator('.site-primary-nav [aria-current=page]')
    expect(active).to_have_count(1)
    expect(active).to_have_attribute('href',('/ru' if lang=='ru' else '')+'/stoicism')
    assert page.locator('.site-primary-nav a').count() == 4
    page.get_by_role('button',name='Add expression pane').click()
    expect(page.get_by_role('textbox',name='Expression text',exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')


def test_unsaved_evidence_blocks_review_and_discard_restores_saved_revision(page):
    original = page.get_by_role('textbox',name='Conclusion text',exact=True).inner_text()
    page.get_by_role('textbox',name='Conclusion review note').fill('A review must not approve text that was never saved.')
    page.get_by_role('textbox',name='Justification link-1',exact=True).fill('An unsaved different justification.')
    expect(page.get_by_test_id('meaning-card')).to_have_attribute('data-status','stale')
    expect(page.get_by_test_id('meaning-card').get_by_role('button',name='Approve after review')).to_be_disabled()
    page.get_by_role('button',name='Review history',exact=True).click()
    expect(page.locator('.au-live')).to_contain_text('Save or discard your drafts')
    page.locator('.au-evidence-row').first.get_by_role('button',name='Discard link draft').click()
    expect(page.get_by_test_id('meaning-card')).to_have_attribute('data-status','awaiting_review')
    page.get_by_role('textbox',name='Conclusion text',exact=True).fill('An unsaved stronger claim.')
    page.get_by_test_id('meaning-card').get_by_role('button',name='Discard draft',exact=True).click()
    expect(page.get_by_role('textbox',name='Conclusion text',exact=True)).to_have_text(original)
    page.get_by_role('button',name='Review history',exact=True).click()
    expect(page.get_by_role('heading',name='Immutable revisions & review history')).to_be_visible()
    assert len(state(page)['revisions']) == len(json.loads((ROOT/'content/aurelius/fixture.json').read_text())['revisions'])


def test_expression_clickthrough_and_inserted_words_do_not_inherit_provenance(page):
    page.get_by_role('button', name='Add expression pane').click()
    mark = page.locator('.au-expression .au-grounded').first
    expect(mark).to_have_attribute('data-conclusion-revision', 'c1:r1')
    mark.click()
    expect(page.locator('[data-passage="demo-p1"] .is-contributor')).to_have_count(1)
    expect(page.locator('[data-passage="demo-p4"] .is-contributor')).to_have_count(0)
    box = page.get_by_role('textbox', name='Expression text', exact=True)
    box.click()
    page.keyboard.press('ControlOrMeta+End')
    page.keyboard.insert_text(' This will guarantee lasting happiness.')
    expect(page.locator('.au-expression .au-grounded')).to_have_count(0)
    expect(page.locator('.au-expression .au-unmapped')).to_contain_text('guarantee lasting happiness')
    page.get_by_test_id('expression-card').get_by_role('button', name='Save revision', exact=True).click()
    wait_saved(page)
    w = state(page)
    rid = w['expressions'][0]['current']
    r = next(r for r in w['revisions'] if r['id'] == rid)
    assert r['dependencies'] == []
    assert w['assessments'][rid]['state'] == 'stale'


def test_all_chunk_pca_map_cluster_cuts_and_exact_point_clickthrough(page):
    w=state(page)
    page.get_by_role('button',name='PCA map · all chunks',exact=True).click()
    explorer=page.get_by_test_id('discovery-explorer')
    expect(explorer).to_be_visible(timeout=30000)
    expect(page.get_by_test_id('map-coverage')).to_have_text(f"{len(w['passages'])} / {len(w['passages'])} chunks mapped")
    expect(page.locator('[data-map-chunk]')).to_have_count(len(w['passages']))
    assert set(page.locator('[data-map-chunk]').evaluate_all('els=>els.map(el=>el.dataset.mapChunk)'))=={p['id'] for p in w['passages']}
    expect(explorer).to_contain_text('not OpenAI embeddings')
    page.get_by_role('combobox',name='Cluster count').select_option('4')
    expect(page.locator('.au-cluster-legend button')).to_have_count(4)
    page.locator('.au-cluster-legend button').first.click()
    expect(page.locator('[data-map-chunk]')).to_have_count(len(w['passages']))
    p=w['passages'][-1]
    page.locator(f'[data-map-chunk="{p["id"]}"]').click()
    expect(page.get_by_role('complementary',name='Selected map chunk')).to_contain_text(p['text'])
    page.get_by_role('button',name='Open chunk in workbench ↗',exact=True).click()
    expect(page.locator(f'[data-passage="{p["id"]}"]')).to_contain_text(p['text'])
    expect(page.get_by_role('combobox',name='Selected teaching')).to_have_value('c-discipline')


def test_default_meaning_and_overlapping_source_gradients_are_visible_and_inspectable(page):
    page.get_by_role('combobox',name='Selected teaching').select_option('c-duty')
    overlap=page.locator('.au-source-text mark[data-contributor-ids="span-duty-1 span-duty-4"]')
    expect(overlap).to_have_count(1)
    assert 'linear-gradient' in overlap.evaluate('el=>getComputedStyle(el).backgroundImage')
    clause=page.locator('.au-meaning-evidence[data-source-span-ids="span-duty-1 span-duty-4"]')
    expect(clause).to_have_count(1)
    assert 'linear-gradient' in clause.evaluate('el=>getComputedStyle(el).backgroundImage')
    clause.focus()
    expect(page.get_by_role('region',name='Selected clause evidence')).to_contain_text('Demo F.1')
    expect(page.get_by_role('region',name='Selected clause evidence')).to_contain_text('supports')
    page.get_by_role('combobox',name='Color mode').select_option('plain')
    assert clause.evaluate('el=>getComputedStyle(el).backgroundImage')=='none'


def test_editing_meaning_does_not_leave_source_colors_on_new_words(page):
    page.get_by_role('combobox',name='Selected teaching').select_option('c-duty')
    expect(page.locator('.au-meaning-evidence')).to_have_count(3)
    page.get_by_role('textbox',name='Conclusion text',exact=True).fill('This new universal promise has no established source mapping.')
    expect(page.locator('.au-meaning-evidence')).to_have_count(0)
    expect(page.locator('.au-meaning .au-unmapped')).to_contain_text('new universal promise')
    page.get_by_test_id('meaning-card').get_by_role('button',name='Discard draft',exact=True).click()
    expect(page.locator('.au-meaning-evidence')).to_have_count(3)
