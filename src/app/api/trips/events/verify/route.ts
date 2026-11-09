import { NextResponse } from 'next/server';
import { authorizeEventSearch, readBoundedBody, verifyEventSources } from '@/lib/trips/event-source.mjs';
import { parseBrief } from '@/lib/trips/brief.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Wrong origin' }, { status: 403, headers });
  if (!await authorizeEventSearch(request)) return NextResponse.json({ error: 'Sign in to check live event sources.' }, { status: 401, headers });
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) return NextResponse.json({ error: 'Request too large' }, { status: 413, headers });
  try {
    const body = await readBoundedBody(request);
    if (body.length > 20_000) throw new Error('Request too large');
    const input = JSON.parse(body);
    const brief = parseBrief(input.brief);
    if (!brief.stayStart || !brief.stayEnd || !brief.timeZone) throw new Error('Stay dates are required');
    if (!Array.isArray(input.urls) || input.urls.some((u: unknown) => typeof u !== 'string' || u.length > 2000)) throw new Error('Invalid source URLs');
    return NextResponse.json(await verifyEventSources(input.urls, brief), { headers });
  } catch {
    return NextResponse.json({ error: 'The dates or source list are invalid.' }, { status: 400, headers });
  }
}
