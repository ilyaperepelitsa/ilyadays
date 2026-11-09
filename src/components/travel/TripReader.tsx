"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { PHOTO_WIDTH, SPOT_WIDTH, commonsWidth, deleteTrip, loadTrip, subscribeTrips, type NoteKind, type TripNote, type TripPlace, type TripCommitment } from "@/lib/trips";
import { MapLinks } from "./MapLinks";

type Copy = ReturnType<typeof strings>;

const NOTE_ORDER: NoteKind[] = ["build", "events", "literature", "film", "keeps"];
const NOTE_LABEL: Record<NoteKind, "visitBuild" | "visitEvents" | "visitBooks" | "visitFilm" | "visitSee"> = {
  build: "visitBuild",
  events: "visitEvents",
  literature: "visitBooks",
  film: "visitFilm",
  keeps: "visitSee",
};

function pick(lang: Lang, en: string, ru?: string) {
  return lang === "ru" ? ru || en : en;
}

function facts(place: TripPlace) {
  return [...place.notes].sort((a, b) => NOTE_ORDER.indexOf(a.kind) - NOTE_ORDER.indexOf(b.kind));
}

/** 200 → "3 h 20 min", 45 → "45 min". */
function duration(copy: Copy, minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts = [h ? copy.tripHoursShort.replace("{n}", String(h)) : "", m ? copy.tripMinutes.replace("{n}", String(m)) : ""];
  return parts.filter(Boolean).join(" ") || copy.tripMinutes.replace("{n}", "0");
}

function madeOn(lang: Lang, iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function TripReader({ lang, id }: { lang: Lang; id: string }) {
  const copy = strings(lang);
  const router = useRouter();
  const trip = useSyncExternalStore(subscribeTrips, () => loadTrip(id), () => undefined);
  const [confirming, setConfirming] = useState(false);

  if (trip === undefined) return null;
  if (!trip) {
    return (
      <section className="hello">
        <h1>{copy.tripMissingTitle}</h1>
        <p>{copy.tripMissing}</p>
        <Link prefetch={false} href={localPath(lang, "/travel")}>{copy.tripBack}</Link>
      </section>
    );
  }

  const made = madeOn(lang, trip.created);
  return (
    <article className="made-trip">
      <header className="hello">
        <p className="eyebrow">
          <Link prefetch={false} href={localPath(lang, "/travel")}>{copy.travelTitle}</Link> / {copy.tripSavedHere}
        </p>
        <h1>{trip.city}</h1>
        {trip.brief?.stayStart ? <p className="made-date" data-testid="trip-stay-dates">{trip.brief.stayStart} — {trip.brief.stayEnd} · {pick(lang, "destination local dates", "местные даты города")}</p> : null}
        {made ? <p className="made-date">{copy.tripMadeOn.replace("{date}", made)}</p> : null}
        {trip.brief?.preferences ? <p className="lede">{trip.brief.preferences}</p> : null}
        {trip.brief?.wishes?.length ? <p><b>{copy.tripWishes}.</b> {trip.brief.wishes.join(" · ")}</p> : null}
        {trip.spine ? <p><b>{copy.tripSpineLabel}.</b> {trip.spine.name} — {pick(lang, trip.spine.why, trip.spine.whyRu)}</p> : null}
        {trip.routes.length > 1 ? (
          <nav className="jump" aria-label={copy.tripRoutes}>
            {trip.routes.map((route, index) => (
              <a key={index} href={`#day-${index + 1}`}>
                {copy.tripDayN.replace("{n}", String(index + 1))} · {pick(lang, route.theme.title, route.theme.titleRu)}
              </a>
            ))}
          </nav>
        ) : null}
      </header>
      {trip.routes.map((route, index) => {
        const minutes = route.stops.reduce((sum, stop) => sum + stop.minutes, 0);
        const title = pick(lang, route.theme.title, route.theme.titleRu);
        return (
          <section key={index} id={`day-${index + 1}`} className="made-route" aria-labelledby={`day-${index + 1}-title`}>
            <header className="made-route-head">
              <p className="made-day">{copy.tripDayN.replace("{n}", String(index + 1))}{route.date ? ` · ${route.date}` : ""}</p>
              <h2 id={`day-${index + 1}-title`}>{title}</h2>
              <p>{pick(lang, route.theme.description, route.theme.descriptionRu)}</p>
              <p className="made-route-meta">
                {copy.tripStopsAt.replace("{n}", String(route.stops.length)).replace("{time}", duration(copy, minutes))}
              </p>
              <MapLinks lang={lang} route={route.stops} label={copy.tripOpenMap} title={title} />
            </header>
            {trip.commitments?.some((c) => c.date === route.date) ? <FixedEvents lang={lang} events={trip.commitments.filter((c) => c.date === route.date)} /> : null}
            {route.schedule?.length ? <p className="trip-hint">{pick(lang, "Walking times below reserve the accepted event windows, with 15-minute transitions. Check real travel times and opening hours before booking.", "Время прогулки учитывает закреплённые события и переходы по 15 минут. Перед покупкой билетов проверьте реальную дорогу и часы работы.")}</p> : null}
            <ol className="made-stops">
              {route.stops.map((stop) => (
                <StopView key={stop.id} lang={lang} city={trip.city} stop={stop} copy={copy} scheduled={route.schedule?.find((s) => s.stopId === stop.id)} />
              ))}
            </ol>
          </section>
        );
      })}
      {trip.commitments?.filter((c) => !trip.routes.some((r) => r.date === c.date)).length ? <section className="made-route"><h2>{pick(lang, "Fixed events on other stay days", "Закреплённые события в другие дни поездки")}</h2><FixedEvents lang={lang} events={trip.commitments.filter((c) => !trip.routes.some((r) => r.date === c.date))} /></section> : null}
      <p><Link prefetch={false} className="button ghost" data-testid="trip-rebuild" href={localPath(lang, `/travel/new?from=${encodeURIComponent(trip.id)}`)}>{pick(lang, "Adjust and rebuild this trip", "Изменить и перестроить поездку")}</Link></p>
      <div className="trip-delete-row">
        {confirming ? (
          <>
            <button
              type="button"
              className="button trip-delete trip-delete-sure"
              onClick={() => {
                deleteTrip(trip.id);
                router.push(localPath(lang, "/travel"));
              }}
            >
              {copy.tripDeleteSure}
            </button>
            <button type="button" className="button ghost" onClick={() => setConfirming(false)} autoFocus>
              {copy.tripDeleteKeep}
            </button>
          </>
        ) : (
          <button type="button" className="button trip-delete" onClick={() => setConfirming(true)}>
            {copy.tripDelete}
          </button>
        )}
      </div>
    </article>
  );
}

/** The model's own search string, made to name the city; trips saved before it existed search by name. */
function searchFor(stop: TripPlace, city: string) {
  const search = stop.search?.trim();
  if (!search) return `${stop.local || stop.name}, ${city}`;
  return search.toLocaleLowerCase().includes(city.trim().toLocaleLowerCase()) ? search : `${search}, ${city}`;
}

function StopView({ lang, city, stop, copy, scheduled }: { lang: Lang; city: string; stop: TripPlace; copy: Copy; scheduled?: { start: string; end: string } }) {
  const wiki = lang === "ru" && stop.wiki.ru ? stop.wiki.ru : stop.wiki.en;
  return (
    <li className={`made-stop${stop.kind === "food" ? " is-food" : ""}`}>
      {stop.photo ? <Shot image={stop.photo} credit /> : null}
      <div className="made-stop-body">
        <h3>{stop.name}{stop.local && stop.local !== stop.name ? <small> {stop.local}</small> : null}</h3>
        <p className="made-stop-meta">
          {stop.kind === "food" ? <span className="chip">{copy.tripFoodStop}</span> : null}
          {scheduled ? <span data-testid="trip-stop-time">{scheduled.start}–{scheduled.end}</span> : null}
          <span>{copy.tripMinutes.replace("{n}", String(stop.minutes))}</span>
        </p>
        <p>{pick(lang, stop.why, stop.whyRu)}</p>
        {stop.wish ? <p className="trip-wish">{copy.tripAskedFor}: {stop.wish}</p> : null}
        <ul className="made-visit">
          <Fact label={copy.visitAccess} text={pick(lang, stop.access.en, stop.access.ru)} />
          <Fact label={copy.visitHours} text={stop.hours} />
          <Fact label={copy.visitDays} text={pick(lang, stop.days.en, stop.days.ru)} />
          {facts(stop).map((note, index) => (
            <Fact key={index} label={copy[NOTE_LABEL[note.kind]]} text={pick(lang, note.en, note.ru)} note={note} />
          ))}
        </ul>
        <MapLinks lang={lang} place={{ lat: stop.lat, lon: stop.lon, name: stop.name, query: searchFor(stop, city) }} title={stop.name}>
          {wiki ? <a className="map-link map-wiki" href={wiki} target="_blank" rel="noopener noreferrer">{copy.visitWiki}</a> : null}
        </MapLinks>
      </div>
    </li>
  );
}

function Fact({ label, text, note }: { label: string; text: string; note?: TripNote }) {
  if (!text) return null;
  return (
    <li>
      <b>{label}</b> <span>{text}</span>
      {note?.image ? <Shot image={note.image} /> : null}
    </li>
  );
}

function Shot({ image, credit }: { image: { thumb: string; page: string; author: string; license: string }; credit?: boolean }) {
  const byline = `${image.author}, ${image.license}`;
  // Commons licences ask for attribution where the picture is shown, so the main photo carries a visible credit.
  return (
    <figure className="made-shot">
      <a href={image.page} target="_blank" rel="noopener noreferrer" title={byline}>
        {/* eslint-disable-next-line @next/next/no-img-element -- hotlinked Commons thumbnail */}
        <img
          crossOrigin="anonymous"
          src={commonsWidth(image.thumb, credit ? PHOTO_WIDTH : SPOT_WIDTH)}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => e.currentTarget.closest("figure")?.remove()}
        />
      </a>
      {credit ? <figcaption>{byline}</figcaption> : null}
    </figure>
  );
}


function FixedEvents({ lang, events }: { lang: Lang; events: TripCommitment[] }) {
  return <section className="trip-panel" data-testid="trip-fixed-events">
    <h3>{pick(lang, "Fixed appointments you accepted", "Закреплённые вами события")}</h3>
    {events.map((c) => <article className="trip-day" key={c.event.id} data-testid="trip-fixed-event">
      <h4>{c.event.name}</h4><p><b>{c.date} · {c.visitTime}</b> {c.event.timeZone} {c.event.utcOffset ?? ""} · {c.durationMinutes} {pick(lang, 'min reserved', 'мин выделено')}</p>
      <p>{c.event.venue} · {c.event.address}</p>
      <p><a href={c.event.sourceUrl} target="_blank" rel="noopener noreferrer">{pick(lang, 'Publisher’s listing', 'Страница организатора')}</a>{c.event.ticketUrl ? <> · <a href={c.event.ticketUrl} target="_blank" rel="noopener noreferrer">{pick(lang, 'Tickets / availability', 'Билеты / наличие')}</a></> : null}</p>
      <p className="trip-hint">{pick(lang, 'Fixed in your itinerary; this does not book admission. Listings and ticket availability can change.', 'Закреплено в маршруте; это не бронирование. Расписание и наличие билетов могут измениться.')}</p>
    </article>)}
  </section>;
}
