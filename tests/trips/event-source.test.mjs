import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { authorizeEventSearch, fetchPublisher, publicIpv4, readBoundedBody, verifyEventSources } from '../../src/lib/trips/event-source.mjs';
import { brief } from './fixtures.mjs';
const dated = { ...brief, stayStart: '2026-11-18', stayEnd: '2026-11-20', timeZone: 'Europe/Lisbon' };
const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'MusicEvent', name: 'Source fixture', startDate: '2026-11-18T19:00+00:00', location: { name: 'Fixture Hall', address: { addressLocality: 'Lisbon' } } })}</script>`;
const resolve = async () => ['8.8.8.8'];
function transportFor(rows, seen = []) {
  return (url, options, receive) => {
    seen.push({ url, options });
    const req = new EventEmitter();
    req.destroy = (e) => { req.destroyed = true; if (e) req.emit('error', e); };
    req.end = () => queueMicrotask(() => {
      const row = rows.shift();
      if (row?.stall) return;
      const res = Readable.from([Buffer.from(row?.body ?? html)]);
      res.statusCode = row?.status ?? 200;
      res.headers = row?.headers ?? { 'content-type': 'text/html' };
      seen[seen.length - 1].response = res;
      seen[seen.length - 1].request = req;
      receive(res);
    });
    return req;
  };
}

test('public source reader blocks all private/special ranges, metadata and mapped IPv6', async () => {
  for (const ip of ['0.0.0.0', '10.1.1.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '100.127.255.255', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:127.0.0.1']) assert.equal(publicIpv4(ip), false, ip);
  assert.equal(publicIpv4('8.8.8.8'), true);
  let calls = 0;
  await assert.rejects(() => fetchPublisher('https://attacker.example/a', { resolve: async () => ['8.8.8.8', '10.0.0.1'], transport: () => { calls++; } }), /Non-public/);
  assert.equal(calls, 0);
});

test('HTTPS transport pins the validated address and retains the publisher hostname for TLS', async () => {
  const seen = [];
  const source = await fetchPublisher('https://publisher.example/a', { resolve, transport: transportFor([{}], seen) });
  assert.equal(source.html, html); assert.equal(seen[0].url.hostname, 'publisher.example');
  let pinned;
  seen[0].options.lookup('publisher.example', {}, (error, address, family) => { assert.equal(error, null); pinned = { address, family }; });
  assert.deepEqual(pinned, { address: '8.8.8.8', family: 4 });
  assert.equal(seen[0].options.headers.Authorization, undefined);
  assert.equal(seen[0].options.headers.Cookie, undefined);
});

test('each redirect is revalidated; private redirects and redirect loops fail closed', async () => {
  const seen = [];
  await assert.rejects(() => fetchPublisher('https://publisher.example/a', { resolve, transport: transportFor([{ status: 302, headers: { location: 'https://169.254.169.254/latest/' } }], seen) }), /Unsupported/);
  assert.equal(seen.length, 1);
  await assert.rejects(() => fetchPublisher('https://publisher.example/a', { resolve, redirects: 1, transport: transportFor([{ status: 302, headers: { location: '/b' } }, { status: 302, headers: { location: '/c' } }]) }), /redirects/);
  const source = await fetchPublisher('https://publisher.example/a', { resolve, transport: transportFor([{ status: 302, headers: { location: '/b' } }, {}]) });
  assert.equal(source.url, 'https://publisher.example/b');
});

test('oversized, non-HTML, unavailable and stalled responses cannot become recommendations', async () => {
  await assert.rejects(() => fetchPublisher('https://publisher.example/a', { resolve, maxBytes: 10, transport: transportFor([{}]) }), /too large/);
  await assert.rejects(() => fetchPublisher('https://publisher.example/a', { resolve, transport: transportFor([{ headers: { 'content-type': 'application/json' } }]) }), /unavailable/);
  await assert.rejects(() => fetchPublisher('https://publisher.example/a', { resolve, transport: transportFor([{ status: 403 }]) }), /unavailable/);
  await assert.rejects(() => fetchPublisher('https://publisher.example/a', { resolve, timeoutMs: 5, transport: transportFor([{ stall: true }]) }), /timeout/);
});

test('source failures leave successful source-derived events and report partial coverage truthfully', async () => {
  const result = await verifyEventSources(['https://good.example/a', 'https://bad.example/a'], dated, { read: async (url) => { if (url.includes('bad')) throw new Error('blocked'); return { url, html }; } });
  assert.equal(result.events.length, 1); assert.equal(result.checked, 2); assert.equal(result.unavailable, 1);
  await assert.rejects(() => verifyEventSources(Array(9).fill('https://good.example/a'), dated), /Too many/);
});

test('authentication is validated with Supabase and failures never perform a privileged source read', async () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://backend.example', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-key' };
  const req = (token) => new Request('https://site.example/api/trips/events/verify', { headers: token ? { Authorization: token } : {} });
  let count = 0;
  const fetcher = async (_url, init) => { count++; assert.equal(init.headers.Authorization, 'Bearer test-access-token'); assert.equal(init.headers.apikey, 'public-test-key'); return { ok: true, json: async () => ({ id: '11111111-1111-4111-8111-111111111111' }) }; };
  assert.equal(await authorizeEventSearch(req(), env, fetcher), false); assert.equal(count, 0);
  assert.equal(await authorizeEventSearch(req('Bearer test-access-token'), env, fetcher), true); assert.equal(count, 1);
  assert.equal(await authorizeEventSearch(req('Bearer test-access-token'), env, async () => ({ ok: false })), false);
  assert.equal(await authorizeEventSearch(req('Bearer test-access-token'), env, async () => { throw new Error('network'); }), false);
});

test('request bodies are bounded while streaming, including requests without Content-Length', async () => {
  const request = new Request('https://site.example/api', { method: 'POST', body: '0123456789' });
  await assert.rejects(() => readBoundedBody(request, 5), /too large/);
  assert.equal(await readBoundedBody(new Request('https://site.example/api', { method: 'POST', body: '{"ok":true}' })), '{"ok":true}');
});


test('redirect and rejected response bodies are destroyed instead of being drained without bounds', async () => {
  for (const row of [ { status: 302, headers: { location: 'https://127.0.0.1/private' } }, { status: 403 }, { headers: { 'content-type': 'application/octet-stream' } } ]) {
    const seen = [];
    await assert.rejects(() => fetchPublisher('https://publisher.example/a', { resolve, transport: transportFor([row], seen) }));
    assert.equal(seen[0].response.destroyed, true);
    assert.equal(seen[0].request.destroyed, true);
  }
});
