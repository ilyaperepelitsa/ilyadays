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
    <section className="recent">
      <div className="recent-head"><h2>{copy.tripSavedHere}</h2></div>
      <div className="tiles tiles-fill">
        {trips.map((trip) => (
          <Link key={trip.id} className="tile tile-plain" href={localPath(lang, `/travel/made/${trip.id}`)}>
            <div className="tile-body">
              <h2>{trip.city}</h2>
              <p>{title(lang, trip)}</p>
              <span className="tile-go">{copy.tripRoutes} · {trip.routes.length}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
