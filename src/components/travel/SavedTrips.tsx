"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { listTrips, subscribeTrips, type SavedTrip } from "@/lib/trips";

const NONE: SavedTrip[] = [];

function title(lang: Lang, trip: SavedTrip) {
  const theme = trip.routes[0]?.theme;
  if (!theme) return trip.city;
  return lang === "ru" ? theme.titleRu || theme.title : theme.title;
}

export function SavedTrips({ lang }: { lang: Lang }) {
  const copy = strings(lang);
  const trips = useSyncExternalStore(subscribeTrips, listTrips, () => NONE);
  if (!trips.length) return null;
  return (
    <section className="recent saved-trips">
      <div className="recent-head"><h2>{copy.tripSavedHere}</h2></div>
      <div className="tiles tiles-fill">
        {trips.map((trip) => (
          <Link prefetch={false} key={trip.id} className="tile saved-trip-card" href={localPath(lang, `/travel/made/${trip.id}`)}>
            <div className="tile-body">
              <h2>{trip.city}</h2>
              {trip.brief?.stayStart && trip.brief.stayEnd ? <p className="saved-trip-dates"><time>{trip.brief.stayStart}</time> — <time>{trip.brief.stayEnd}</time></p> : null}
              <p>{title(lang, trip)}</p>
              <span className="tile-go">
                {copy.tripCounts
                  .replace("{routes}", String(trip.routes.length))
                  .replace("{stops}", String(new Set(trip.routes.flatMap((route) => route.stops.map((stop) => stop.id))).size))}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
