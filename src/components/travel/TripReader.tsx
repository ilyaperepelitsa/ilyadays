"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { deleteTrip, loadTrip, mapsUrl, subscribeTrips, type NoteKind, type TripNote, type TripPlace } from "@/lib/trips";

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

export function TripReader({ lang, id }: { lang: Lang; id: string }) {
  const copy = strings(lang);
  const router = useRouter();
  const trip = useSyncExternalStore(subscribeTrips, () => loadTrip(id), () => undefined);

  if (trip === undefined) return null;
  if (!trip) {
    return (
      <section className="hello">
        <p>{copy.tripMissing}</p>
        <Link href={localPath(lang, "/travel")}>{copy.tripBack}</Link>
      </section>
    );
  }

  return (
    <article className="made-trip">
      <header className="hello">
        <h1>{trip.city}</h1>
        <p className="lede">{copy.tripSavedHere}</p>
        {trip.brief?.preferences ? <p>{trip.brief.preferences}</p> : null}
        {trip.brief?.wishes?.length ? <p><b>{copy.tripWishes}.</b> {trip.brief.wishes.join(" · ")}</p> : null}
        {trip.spine ? <p><b>{copy.tripSpineLabel}.</b> {trip.spine.name} — {pick(lang, trip.spine.why, trip.spine.whyRu)}</p> : null}
      </header>
      {trip.routes.map((route, index) => (
        <section key={index} className="made-route">
          <h2>{pick(lang, route.theme.title, route.theme.titleRu)}</h2>
          <p>{pick(lang, route.theme.description, route.theme.descriptionRu)}</p>
          <ol>
            {route.stops.map((stop) => (
              <StopView key={stop.id} lang={lang} stop={stop} copy={copy} />
            ))}
          </ol>
          <a href={mapsUrl(route.stops)} target="_blank" rel="noopener">{copy.tripOpenMap}</a>
        </section>
      ))}
      <button
        type="button"
        className="button trip-delete"
        onClick={() => {
          deleteTrip(trip.id);
          router.push(localPath(lang, "/travel"));
        }}
      >
        {copy.tripDelete}
      </button>
    </article>
  );
}

function StopView({ lang, stop, copy }: { lang: Lang; stop: TripPlace; copy: ReturnType<typeof strings> }) {
  const wiki = lang === "ru" && stop.wiki.ru ? stop.wiki.ru : stop.wiki.en;
  return (
    <li>
      {stop.photo ? <Shot image={stop.photo} /> : null}
      <h3>{stop.name}{stop.local ? <small> {stop.local}</small> : null}</h3>
      <p>{stop.kind === "food" ? `${copy.tripFoodStop} · ` : ""}{copy.tripMinutes.replace("{n}", String(stop.minutes))}</p>
      <p>{pick(lang, stop.why, stop.whyRu)}</p>
      {stop.wish ? <p className="trip-wish">{copy.tripAskedFor}: {stop.wish}</p> : null}
      <ul className="made-visit">
        <Fact label={copy.visitAccess} text={pick(lang, stop.access.en, stop.access.ru)} />
        <Fact label={copy.visitHours} text={stop.hours} />
        <Fact label={copy.visitDays} text={pick(lang, stop.days.en, stop.days.ru)} />
        {facts(stop).map((note, index) => (
          <Fact key={index} label={copy[NOTE_LABEL[note.kind]]} text={pick(lang, note.en, note.ru)} note={note} />
        ))}
        {wiki ? (
          <li>
            <b>{copy.visitWiki}</b> <a href={wiki} target="_blank" rel="noopener">{copy.visitWiki}</a>
          </li>
        ) : null}
      </ul>
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

function Shot({ image }: { image: { thumb: string; page: string; author: string; license: string } }) {
  const credit = `${image.author}, ${image.license}`;
  return (
    <a className="made-shot" href={image.page} target="_blank" rel="noopener" title={credit}>
      {/* eslint-disable-next-line @next/next/no-img-element -- hotlinked Commons thumbnail */}
      <img src={image.thumb} alt="" onError={(e) => e.currentTarget.parentElement?.remove()} />
    </a>
  );
}
