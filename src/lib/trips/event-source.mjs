/** Server-only public publisher reader. HTTPS connects to the already-vetted IP, not a second DNS lookup. */
import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
import { publicHttps, eventsFromSource } from './events.mjs';

export function publicIpv4(ip) {
  const p = String(ip).split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && [0, 2].includes(c)) || (a === 192 && b === 88 && c === 99) || (a === 198 && [18, 19].includes(b)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
}

/** Dependency injection is test-only; the production transport never resolves the hostname a second time. */
export async function fetchPublisher(url, { resolve = resolve4, transport = request, timeoutMs = 7000, maxBytes = 2_000_000, redirects = 2, deadline = Date.now() + 10000 } = {}) {
  const target = publicHttps(url);
  if (!target) throw new Error('Unsupported source URL');
  const u = new URL(target);
  timeoutMs = Math.min(timeoutMs, deadline - Date.now());
  if (timeoutMs <= 0) throw new Error("Source deadline exceeded");
  const addresses = await Promise.race([resolve(u.hostname), new Promise((_, reject) => { const t = setTimeout(() => reject(new Error('DNS timeout')), timeoutMs); t.unref?.(); })]);
  if (!addresses.length || addresses.some((ip) => !publicIpv4(ip))) throw new Error('Non-public source address');
  const response = await new Promise((done, reject) => {
    let timer;
    const req = transport(u, { method: 'GET', family: 4, lookup: (_host, _options, callback) => callback(null, addresses[0], 4), headers: { 'User-Agent': 'ilyadays-event-check/1.0', Accept: 'text/html,application/xhtml+xml' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        done({ redirect: res.headers.location, html: '' });
        res.destroy(); req.destroy(); clearTimeout(timer); return;
      }
      if (res.statusCode !== 200 || !/^text\/html|^application\/xhtml\+xml/i.test(String(res.headers['content-type'] ?? ''))) {
        reject(new Error('Source unavailable')); res.destroy(); req.destroy(); clearTimeout(timer); return;
      }
      const chunks = []; let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) { req.destroy(new Error('Source too large')); res.destroy(); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => { clearTimeout(timer); done({ html: Buffer.concat(chunks).toString('utf8') }); });
    });
    req.on('error', (error) => { clearTimeout(timer); reject(error); });
    timer = setTimeout(() => req.destroy(new Error('Source timeout')), Math.max(1, Math.min(timeoutMs, deadline - Date.now())));
    req.end();
  });
  if (response.redirect) {
    if (redirects <= 0) throw new Error('Too many source redirects');
    return fetchPublisher(new URL(response.redirect, u).href, { resolve, transport, timeoutMs, maxBytes, redirects: redirects - 1, deadline });
  }
  return { html: response.html, url: target };
}

export async function verifyEventSources(urls, brief, { read = fetchPublisher, verifiedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(urls) || urls.length > 8) throw new Error('Too many sources');
  const events = [], failures = [];
  for (let i = 0; i < urls.length; i += 4) {
    await Promise.all(urls.slice(i, i + 4).map(async (url) => {
      try {
        const source = await read(url);
        events.push(...eventsFromSource(source.html, source.url, brief, verifiedAt));
      } catch { failures.push(url); }
    }));
  }
  return { events: [...new Map(events.map((e) => [e.id, e])).values()].slice(0, 12), checked: urls.length, unavailable: failures.length };
}

/** Validate an actual access token against Supabase; no browser-supplied user id or editable metadata is trusted. */
export async function authorizeEventSearch(request, env = process.env, fetcher = fetch) {
  const auth = request.headers.get('authorization') ?? '';
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!/^Bearer [^\s]{10,8192}$/.test(auth) || !url || !key) return false;
  try {
    const r = await fetcher(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: auth }, signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error' });
    const data = r.ok ? await r.json() : null;
    return typeof data?.id === 'string' && /^[0-9a-f-]{36}$/i.test(data.id);
  } catch { return false; }
}


export async function readBoundedBody(request, maxBytes = 20000) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing request body');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Request too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { await reader.cancel().catch(() => {}); }
}
