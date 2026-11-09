# Trip creation, selected dates and accepted events

The trip composer supports optional inclusive stay dates (at most 90 days) and keeps undated trips compatible.
The number of walking routes cannot exceed the stay's calendar days. Dated routes receive real date labels.

Live event discovery uses the caller's existing OpenAI API key and web search. Source verification requires
sign-in, checks the actual access token against Supabase, and fetches publisher pages through a bounded public
HTTPS/IPv4 transport with DNS pinning and redirect revalidation. Only valid matching-city Event JSON-LD with
publisher-published dates/venue data is eligible. Unavailable/unverifiable listings are omitted; an empty result
is not proof that no events exist. No sources or dates are fabricated when verification fails.

The user explicitly selects the destination time zone. Source instants convert into its local calendar and clock,
including date rollover and DST. Ambiguous/nonexistent unzoned times and invalid or contradictory end dates are
rejected. Concert times stay fixed; exhibition visit time is a user planning choice and needs opening-hour review.

Suggestions remain outside the itinerary until the user accepts them. Accepted events are deep-copied dated
commitments with source, venue, duration and acceptance timestamp. The user can explicitly remove a commitment;
changing dates/city/zone cannot silently move one. Generation and rebuild validate commitments before producing
and saving a new trip. Deterministic schedules reserve fixed event windows first and check overlaps, travel buffers
and the daily budget. Saved events render with sources and ticket/availability links; no purchase/booking occurs.
Walking/travel times and opening hours still need human review.

Rebuilding produces a new saved trip carrying accepted commitments. Browser storage retains the newest 20 trips;
this limit can evict an old original. A refused storage write shows an error instead of navigating to a missing trip.

Verification includes existing creation/parse/retry tests, date/calendar boundaries, source provenance, authenticated
bounded verification, SSRF/DNS/redirect/timeout/streaming limits, invalid end dates, UTC/DST handling, commitment
immutability, conflict/duration budgets and browser acceptance/rejection/rebuild/error flows. API calls in browser
verification are deterministic fixtures; no billed live API calls are claimed.
