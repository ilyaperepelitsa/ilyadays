"""Production-browser trip creation and accepted-event rebuild checks; all billable/network APIs are fixtures.
TRIP_E2E_BASE=http://localhost:3140 python -m pytest tests/trips/e2e -q
"""
import base64
import json
import os
import re
import time
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('TRIP_E2E_BASE', 'http://localhost:3140')
ROOT = Path(__file__).resolve().parents[3]
PROJECT = 'mnqfdfxyodkakthxuwkw.supabase.co'
for line in ((ROOT / '.env.local').read_text().splitlines() if (ROOT / '.env.local').exists() else []):
    if line.startswith('NEXT_PUBLIC_SUPABASE_URL='):
        PROJECT = line.split('=', 1)[1].strip().strip('"\'').split('://')[-1].split('/')[0]


def encoded(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')


@pytest.fixture(scope='session')
def browser():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        yield b
        b.close()


class Backend:
    def __init__(self, page):
        self.page = page
        self.calls = []
        self.error = None
        self.retry_once = False
        self.outline_calls = 0
        self.empty_events = False
        page.route('https://api.openai.com/v1/responses', self.ai)
        page.route('**/api/trips/events/verify', self.verify)
        page.route('**/w/api.php*', lambda r: r.fulfill(status=200, content_type='application/json', body='{"query":{"pages":[]}}'))
        page.route('**/rest/v1/rpc/is_admin', lambda r: r.fulfill(status=200, content_type='application/json', body='false'))
        page.route('**/_vercel/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))

    def ai(self, route):
        body = route.request.post_data_json
        name = body['text']['format']['name']
        self.calls.append((name, body))
        if self.error:
            return route.fulfill(status=401, content_type='application/json', body=json.dumps({'error': {'message': self.error}}))
        args = json.loads(body['input'][1]['content'])
        schema = body['text']['format']['schema']
        output = []
        if name == 'trip_event_sources':
            result = {'urls': ['https://publisher.example/fixture-concert']}
            output.append({'type': 'web_search_call', 'action': {'sources': [{'url': result['urls'][0]}]}})
        elif name == 'trip_themes':
            result = {'themes': [{'title': f'Walk {i+1}', 'description': f'A compact walk {i+1}.', 'titleRu': f'Прогулка {i+1}', 'descriptionRu': 'Короткая прогулка.'} for i in range(schema['properties']['themes']['minItems'])]}
        elif name == 'trip_outline':
            self.outline_calls += 1
            if self.retry_once and self.outline_calls == 1:
                return route.fulfill(status=503, content_type='application/json', body='{"error":{"message":"temporary fixture failure"}}')
            count = schema['properties']['routes']['minItems']
            sights, meals = map(int, re.search(r'exactly (\d+) sights and exactly (\d+) food stops', body['input'][0]['content']).groups())
            routes = []
            for day in range(count):
                stops = []
                for i in range(sights + meals):
                    stops.append({'id': f'd{day}-s{i}', 'name': f'Fixture place {day}-{i}', 'local': '', 'search': f'Fixture {day} {i} Lisbon', 'lat': 38.7 + day * .01 + i * .001, 'lon': -9.14, 'minutes': 25, 'kind': 'sight' if i < sights else 'food', 'why': 'A fixture stop.', 'whyRu': 'Тестовая остановка.', 'wish': ''})
                routes.append({'stops': stops})
            result = {'spine': {'name': '', 'why': '', 'whyRu': ''}, 'routes': routes}
        else:
            result = {'places': [{'id': s['id'], 'accessEn': 'Check admission.', 'accessRu': 'Проверьте вход.', 'daysEn': 'Check venue.', 'daysRu': 'Проверьте дни.', 'hours': 'Check venue', 'wikiTitle': '', 'spotSearch': '', 'notes': [{'kind': 'keeps', 'en': 'Fixture detail.', 'ru': 'Тестовая деталь.'}, {'kind': 'build', 'en': 'Fixture history.', 'ru': 'Тестовая история.'}]} for s in args['stops']]}
        output.append({'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(result)}]})
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'output': output}))

    def verify(self, route):
        assert route.request.headers.get('authorization', '').startswith('Bearer ')
        payload = route.request.post_data_json
        assert payload['brief']['stayStart'] == '2026-11-18'
        event = {'id': 'fixture-concert', 'name': 'Source-confirmed fixture concert', 'venue': 'Fixture Hall', 'address': 'Fixture Street, Lisbon', 'city': 'Lisbon', 'kind': 'concert', 'availableFrom': '2026-11-18', 'availableThrough': '2026-11-18', 'fixedTime': '19:00', 'durationMinutes': 120, 'timeZone': 'Europe/Lisbon', 'sourceUrl': 'https://publisher.example/fixture-concert', 'verifiedAt': '2026-11-09T00:00:00Z'}
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'events': [] if self.empty_events else [event], 'checked': 1, 'unavailable': 1 if self.empty_events else 0}))


@pytest.fixture
def phone(browser):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    now = int(time.time())
    user = {'id': '11111111-1111-4111-8111-111111111111', 'aud': 'authenticated', 'role': 'authenticated', 'email': 'fixture@example.invalid', 'user_metadata': {'full_name': 'Fixture User'}}
    token = '.'.join([encoded({'alg': 'HS256', 'typ': 'JWT'}), encoded({'sub': user['id'], 'exp': now + 7200, 'iat': now, 'role': 'authenticated', 'aud': 'authenticated'}), 'fixture-signature'])
    session = {'access_token': token, 'refresh_token': 'fixture-refresh', 'expires_in': 7200, 'expires_at': now+7200, 'token_type': 'bearer', 'user': user}
    context.add_init_script(f"localStorage.setItem({json.dumps('ilyadays-auth:' + PROJECT)}, {json.dumps(json.dumps(session))}); localStorage.setItem('cdays-ai-key','sk-fixture-never-real');")
    page = context.new_page()
    backend = Backend(page)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    yield page, backend, errors
    context.close()


def tid(page, value):
    return page.get_by_test_id(value)


def setup_trip(page, dated=True, ru=False):
    page.goto(BASE + ('/ru/travel/new' if ru else '/travel/new'))
    tid(page, 'trip-city').fill('Lisbon')
    if dated:
        tid(page, 'trip-arrival').fill('2026-11-18')
        tid(page, 'trip-departure').fill('2026-11-20')
        tid(page, 'trip-timezone').fill('Europe/Lisbon')
    tid(page, 'trip-suggest-themes').click()
    expect(page.locator('.trip-day input').first).to_have_value('Walk 1')


def stored_trips(page):
    return page.evaluate("JSON.parse(localStorage.getItem('ilyadays-trips-v1') || '[]')")


def generate(page):
    tid(page, 'trip-generate').click()
    expect(page).to_have_url(re.compile(r'/travel/made/[a-f0-9-]+$'), timeout=30000)


def test_selected_dates_accepted_event_schedule_reload_and_rebuild(phone):
    page, backend, errors = phone
    setup_trip(page)
    tid(page, 'trip-find-events').click()
    expect(tid(page, 'trip-event-option')).to_be_visible()
    assert stored_trips(page) == [], 'a suggestion alone never creates a trip or booking'
    tid(page, 'trip-accept-event').click()
    expect(tid(page, 'trip-accepted-events')).to_contain_text('19:00')
    generate(page)
    expect(tid(page, 'trip-fixed-event')).to_contain_text('2026-11-18')
    expect(tid(page, 'trip-fixed-event')).to_contain_text('19:00')
    first = stored_trips(page)[0]
    assert len(first['commitments']) == 1
    assert first['routes'][0]['date'] == '2026-11-18'
    assert all(s['end'] < '18:45' for s in first['routes'][0]['schedule'])
    page.reload()
    expect(tid(page, 'trip-fixed-event')).to_contain_text('Source-confirmed fixture concert')
    tid(page, 'trip-rebuild').click()
    expect(tid(page, 'trip-accepted-events')).to_contain_text('Source-confirmed fixture concert')
    generate(page)
    trips = stored_trips(page)
    assert len(trips) == 2
    assert trips[0]['revisionOf'] == first['id']
    assert trips[0]['commitments'] == first['commitments']
    assert not errors
    assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')


def test_suggested_but_rejected_event_never_enters_saved_plan(phone):
    page, backend, errors = phone
    setup_trip(page)
    tid(page, 'trip-find-events').click()
    expect(tid(page, 'trip-event-option')).to_be_visible()
    tid(page, 'trip-accept-event').click()
    tid(page, 'trip-remove-event').click()
    generate(page)
    assert not stored_trips(page)[0].get('commitments')
    expect(tid(page, 'trip-fixed-event')).to_have_count(0)
    assert not errors


def test_empty_verified_search_and_undated_legacy_creation_remain_usable(phone):
    page, backend, errors = phone
    backend.empty_events = True
    setup_trip(page)
    tid(page, 'trip-find-events').click()
    expect(tid(page, 'trip-no-events')).to_be_visible()
    expect(tid(page, 'trip-events-partial')).to_be_visible()
    tid(page, 'trip-arrival').fill('')
    tid(page, 'trip-departure').fill('')
    generate(page)
    assert 'stayStart' not in stored_trips(page)[0]['brief']
    assert not errors


def test_changed_dates_do_not_silently_move_an_accepted_event(phone):
    page, backend, errors = phone
    setup_trip(page)
    tid(page, 'trip-find-events').click()
    tid(page, 'trip-accept-event').click()
    tid(page, 'trip-arrival').fill('2026-11-19')
    tid(page, 'trip-generate').click()
    expect(tid(page, 'trip-error')).to_contain_text('Review the accepted events')
    assert stored_trips(page) == []
    assert not any(name == 'trip_outline' for name, _ in backend.calls)
    assert not errors


def test_generation_retries_temporary_failure_and_keeps_accepted_event(phone):
    page, backend, errors = phone
    backend.retry_once = True
    setup_trip(page, ru=True)
    tid(page, 'trip-find-events').click()
    tid(page, 'trip-accept-event').click()
    generate(page)
    assert backend.outline_calls == 2
    assert stored_trips(page)[0]['commitments'][0]['visitTime'] == '19:00'
    assert not errors


def test_invalid_dates_and_api_error_are_visible_without_saving(phone):
    page, backend, errors = phone
    setup_trip(page)
    tid(page, 'trip-departure').fill('2026-11-17')
    tid(page, 'trip-generate').click()
    expect(tid(page, 'trip-error')).to_contain_text('Choose valid arrival')
    assert not any(name == 'trip_outline' for name, _ in backend.calls)
    tid(page, 'trip-departure').fill('2026-11-20')
    backend.error = 'Fixture key rejected'
    tid(page, 'trip-generate').click()
    expect(tid(page, 'trip-error')).to_contain_text('Fixture key rejected')
    assert stored_trips(page) == []
    assert not errors


def test_refused_trip_storage_does_not_navigate_to_a_missing_saved_trip(phone):
    page, backend, errors = phone
    setup_trip(page)
    page.evaluate("""() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(k,v) { if(k==='ilyadays-trips-v1') throw new Error('fixture quota'); return original.call(this,k,v); }; }""")
    tid(page, 'trip-generate').click()
    expect(tid(page, 'trip-error')).to_contain_text('browser could not save', timeout=30000)
    assert '/travel/new' in page.url
    assert stored_trips(page) == []
    assert not errors
