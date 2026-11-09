import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stayDates, validDate } from '../../src/lib/trips/dates.mjs';
import { parseBrief } from '../../src/lib/trips/brief.mjs';
import { acceptEvent, eventSearchCall, eventsFromSource, publicHttps, scheduleDay, validateCommitments } from '../../src/lib/trips/events.mjs';
import { buildTrip } from '../../src/lib/trips/generate.mjs';
import { brief, facts, outline } from './fixtures.mjs';

export const dated = { ...brief, stayStart: '2026-11-18', stayEnd: '2026-11-20', timeZone: 'Europe/Lisbon' };
export const sourceEvent = (patch = {}) => ({ '@context': 'https://schema.org', '@type': 'MusicEvent', name: 'Fixture concert', startDate: '2026-11-18T19:00:00+00:00', endDate: '2026-11-18T21:00:00+00:00', eventStatus: 'https://schema.org/EventScheduled', location: { '@type': 'Place', name: 'Fixture Hall', address: { streetAddress: 'Fixture Street', addressLocality: 'Lisbon', addressCountry: 'PT' } }, offers: { url: 'https://publisher.example/tickets/fixture' }, ...patch });
export const htmlEvent = (event = sourceEvent()) => `<html><script type="application/ld+json">${JSON.stringify(event)}</script></html>`;
export const fixtureEvent = () => eventsFromSource(htmlEvent(), 'https://publisher.example/concert', dated, '2026-11-09T00:00:00Z')[0];

const themes = [{ title: 'River', description: 'The river.', titleRu: 'Река', descriptionRu: 'У реки.' }, { title: 'Hills', description: 'The hills.', titleRu: 'Холмы', descriptionRu: 'Холмы.' }];
const client = async (call) => call.name === 'trip_outline' ? outline() : { places: JSON.parse(call.user).stops.map((s) => facts(s.id, s.kind)) };
const enrich = async (stop, f) => ({ ...stop, hours: f.hours, access: f.access, days: f.days, wiki: { en: '' }, notes: f.notes });

test('calendar validation includes both boundaries, leap day and does not normalize impossible dates', () => {
  assert.deepEqual(stayDates('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2026-11-31'), false);
  assert.throws(() => stayDates('2026-11-20', '2026-11-18'));
  assert.throws(() => stayDates('2026-11-18', ''));
  assert.throws(() => stayDates('2026-01-01', '2027-01-01'));
  assert.throws(() => parseBrief({ ...dated, stayEnd: dated.stayStart }), (e) => e.code === 'dates');
  assert.deepEqual(parseBrief(brief), brief, 'undated legacy contract stays unchanged');
});

test('only actual source-published event dates and venue in the requested city are accepted', () => {
  const found = fixtureEvent();
  assert.equal(found.name, 'Fixture concert');
  assert.equal(found.fixedTime, '19:00');
  assert.equal(found.durationMinutes, 120);
  assert.equal(found.timeZone, 'Europe/Lisbon');
  assert.equal(found.venue, 'Fixture Hall');
  assert.equal(found.sourceUrl, 'https://publisher.example/concert');
  for (const patch of [
    { eventStatus: 'https://schema.org/EventCancelled' }, { eventStatus: 'https://schema.org/EventPostponed' },
    { eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode' }, { startDate: '2025-11-18', endDate: '2025-11-18' },
    { startDate: '2026-11-31', endDate: '2026-11-31' }, { startDate: '2026-11-18T19:00madeup' },
    { location: { name: 'Unknown hall' } }, { location: { name: 'Wrong city', address: { addressLocality: 'Paris' } } },
  ]) assert.equal(eventsFromSource(htmlEvent(sourceEvent(patch)), found.sourceUrl, dated).length, 0, JSON.stringify(patch));
  assert.deepEqual(eventsFromSource('<h1>A model asserted an event</h1>', found.sourceUrl, dated), []);
  assert.deepEqual(eventsFromSource('<script type="application/ld+json">oops</script>', found.sourceUrl, dated), []);
});

test('exhibitions spanning the stay allow an explicit visit date and source @graph location references', () => {
  const row = sourceEvent({ '@type': 'ExhibitionEvent', startDate: '2026-10-01', endDate: '2027-01-10', location: { '@id': '#hall' } });
  const source = { '@graph': [row, { '@id': '#hall', name: 'Gallery', address: { addressLocality: 'Lisbon' } }] };
  const event = eventsFromSource(htmlEvent(source), 'https://publisher.example/exhibition', dated)[0];
  const c = acceptEvent(event, dated, { date: '2026-11-19', visitTime: '14:00', durationMinutes: 90 });
  assert.equal(c.date, '2026-11-19'); assert.equal(c.visitTime, '14:00');
  assert.throws(() => acceptEvent(event, dated, { date: '2026-11-21', visitTime: '14:00' }));
});

test('acceptance is explicit, immutable and rejects fixed time changes, wrong city or shortened published duration', () => {
  const event = fixtureEvent();
  const c = acceptEvent(event, dated);
  event.name = 'Changed after consent';
  assert.equal(c.event.name, 'Fixture concert');
  assert.throws(() => acceptEvent(c.event, dated, { visitTime: '20:00' }), (e) => e.code === 'events');
  assert.throws(() => acceptEvent(c.event, dated, { durationMinutes: 60 }), (e) => e.code === 'events');
  assert.throws(() => acceptEvent(c.event, { ...dated, city: 'Paris' }), (e) => e.code === 'events');
  assert.throws(() => acceptEvent(c.event, { ...dated, stayStart: '2026-11-19' }), (e) => e.code === 'events');
  assert.deepEqual(validateCommitments([], dated), []);
});

test('accepted events need thirty minutes between venues and cannot be duplicated', () => {
  const first = acceptEvent(fixtureEvent(), dated);
  const second = { ...first, event: { ...first.event, id: 'second' }, visitTime: '20:30' };
  second.event.fixedTime = '20:30'; second.event.startsAt = '2026-11-18T20:30:00.000Z'; second.event.endsAt = '2026-11-18T22:30:00.000Z';
  assert.throws(() => validateCommitments([first, second], dated), (e) => e.code === 'event_conflict');
  assert.throws(() => validateCommitments([first, first], dated), (e) => e.code === 'event_conflict');
  const enough = { ...second, visitTime: '21:30', durationMinutes: 120, event: { ...second.event, fixedTime: '21:30', startsAt: '2026-11-18T21:30:00.000Z', endsAt: '2026-11-18T23:30:00.000Z' } };
  assert.equal(validateCommitments([first, enough], dated).length, 2);
});

test('walking stops are scheduled outside fixed event windows and insufficient days fail before enrichment', async () => {
  const fixed = acceptEvent(fixtureEvent(), dated);
  const schedule = scheduleDay(outline().routes[0].stops, [fixed], 8);
  assert.equal(schedule.length, 3);
  assert.ok(schedule.every((s) => s.end < '18:45'));
  assert.throws(() => scheduleDay(outline().routes[0].stops, [fixed], 4), (e) => e.code === 'event_budget');
  let enriched = 0;
  await assert.rejects(() => buildTrip({ brief: { ...dated, hours: 4 }, themes, client, enrich: async () => { enriched++; }, id: 'x', created: 'now', commitments: [fixed], pauseMs: 0 }), (e) => e.code === 'event_budget');
  assert.equal(enriched, 0);
});

test('generation, regeneration and model omission cannot move or drop an accepted appointment', async () => {
  const commitment = acceptEvent(fixtureEvent(), dated);
  const first = await buildTrip({ brief: dated, themes, client, enrich, commitments: [commitment], id: 'first', created: 'now', pauseMs: 0 });
  assert.deepEqual(first.commitments, [commitment]);
  assert.deepEqual(first.routes.map((r) => r.date), ['2026-11-18', '2026-11-19']);
  const second = await buildTrip({ brief: first.brief, themes, client, enrich, commitments: first.commitments, revisionOf: first.id, id: 'second', created: 'later', pauseMs: 0 });
  assert.deepEqual(second.commitments, [commitment]); assert.equal(second.revisionOf, first.id);
  const withoutConsent = await buildTrip({ brief: dated, themes, client, enrich, id: 'unselected', created: 'now', pauseMs: 0 });
  assert.equal(withoutConsent.commitments, undefined);
  assert.equal(first.commitments[0].date, '2026-11-18');
});

test('search requests actual live sources and rejects undated briefs', () => {
  const call = eventSearchCall(dated);
  assert.equal(call.webSearch, true); assert.match(call.user, /2026-11-18/);
  assert.throws(() => eventSearchCall(brief));
});

test('external links reject credentials, private literal IPs, non-TLS and unusual ports', () => {
  for (const u of ['http://example.org', 'https://user:pass@example.org', 'https://localhost/', 'https://127.0.0.1/', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://example.org:8443/']) assert.equal(publicHttps(u), null, u);
  assert.equal(publicHttps('https://example.org/event#x'), 'https://example.org/event');
});


test('publisher UTC instants are converted to destination timezone and date before selection', () => {
  const rome = { ...dated, city: 'Rome', timeZone: 'Europe/Rome' };
  const listing = sourceEvent({ startDate: '2026-11-18T19:00:00Z', endDate: '2026-11-18T21:00:00Z', location: { name: 'Hall', address: { addressLocality: 'Roma' } } });
  const [event] = eventsFromSource(htmlEvent(listing), 'https://publisher.example/rome', rome);
  assert.equal(event.fixedTime, '20:00'); assert.equal(event.timeZone, 'Europe/Rome'); assert.equal(event.durationMinutes, 120);
  const late = { ...listing, startDate: '2026-11-18T23:30:00Z', endDate: '2026-11-19T01:00:00Z' };
  const [night] = eventsFromSource(htmlEvent(late), 'https://publisher.example/night', rome);
  assert.equal(night.availableFrom, '2026-11-19'); assert.equal(night.fixedTime, '00:30');
  assert.equal(acceptEvent(night, rome).date, '2026-11-19');
  assert.throws(() => acceptEvent(event, { ...rome, timeZone: 'UTC' }), (e) => e.code === 'events');
  assert.deepEqual(eventsFromSource(htmlEvent(listing), 'https://publisher.example/rome', { ...rome, timeZone: undefined }), []);
});

test('DST is resolved by real instants; ambiguous or nonexistent unzoned times are not pinned', () => {
  const rome = { ...dated, city: 'Rome', stayStart: '2026-10-25', stayEnd: '2026-10-26', timeZone: 'Europe/Rome' };
  const venue = { name: 'Hall', address: { addressLocality: 'Roma' } };
  const source = (startDate, endDate) => eventsFromSource(htmlEvent(sourceEvent({ startDate, endDate, location: venue })), 'https://publisher.example/dst', rome);
  const [first] = source('2026-10-25T00:30:00Z', '2026-10-25T01:00:00Z');
  const [second] = source('2026-10-25T01:30:00Z', '2026-10-25T02:00:00Z');
  assert.equal(first.fixedTime, '02:30'); assert.equal(second.fixedTime, '02:30');
  assert.equal(validateCommitments([acceptEvent(first, rome), acceptEvent({ ...second, id: 'second' }, rome)], rome).length, 2, 'same wall clock on DST fallback can be different nonoverlapping instants');
  assert.deepEqual(source('2026-10-25T02:30:00', '2026-10-25T03:30:00'), []);
  const spring = { ...rome, stayStart: '2026-03-29', stayEnd: '2026-03-30' };
  assert.deepEqual(eventsFromSource(htmlEvent(sourceEvent({ startDate: '2026-03-29T02:30:00', endDate: '2026-03-29T03:30:00', location: venue })), 'https://publisher.example/spring', spring), []);
});

test('a present malformed or nonpositive endDate cannot be replaced by an invented duration', () => {
  for (const endDate of ['2026-11-31T21:00:00Z', '2026-11-18T18:00:00Z', '2026-11-18T19:00:00Z', '', null]) {
    assert.deepEqual(eventsFromSource(htmlEvent(sourceEvent({ endDate })), 'https://publisher.example/bad-end', dated), [], String(endDate));
  }
  const listing = sourceEvent(); delete listing.endDate;
  assert.equal(eventsFromSource(htmlEvent(listing), 'https://publisher.example/no-end', dated).length, 1, 'only an absent endDate can leave duration unknown');
});


test('large malformed publisher HTML is scanned once instead of retrying every unclosed script opener', () => {
  const malformed = '<script type="application/ld+json">'.repeat(45000);
  assert.ok(malformed.length > 1_500_000 && malformed.length < 2_000_000);
  const started = process.cpuUsage();
  assert.deepEqual(eventsFromSource(malformed, 'https://publisher.example/hostile', dated), []);
  const elapsed = process.cpuUsage(started);
  assert.ok(elapsed.user + elapsed.system < 500000, `malformed source consumed ${(elapsed.user + elapsed.system) / 1000}ms CPU`);
  assert.equal(eventsFromSource(`<script>unrelated()</script>${htmlEvent()}`, 'https://publisher.example/valid-after-script', dated).length, 1);
});

test('hostile publisher text and links are bounded before sanitization or URL parsing', () => {
  const hostile = sourceEvent({ name: '<'.repeat(1_500_000), offers: {url:'https://publisher.example/'+'x'.repeat(200000)} });
  const started = process.cpuUsage();
  const found = eventsFromSource(htmlEvent(hostile), 'https://publisher.example/hostile-text', dated);
  const elapsed = process.cpuUsage(started);
  assert.ok(elapsed.user + elapsed.system < 500000, `malformed field consumed ${(elapsed.user+elapsed.system)/1000}ms CPU`);
  for (const event of found) { assert.ok(event.name.length <= 200); assert.equal(event.ticketUrl, undefined); }
  assert.equal(publicHttps('https://publisher.example/'+'a'.repeat(2001)),null);
});
