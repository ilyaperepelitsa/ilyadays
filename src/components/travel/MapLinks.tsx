// "Open in Google Maps · Yandex Maps · Apple Maps" for one place, or "Walk it in …" for a route. Plain links, so it
// renders on the server for static pages and inside client components alike.
import type { ReactNode } from "react";
import { type Lang, strings } from "@/lib/i18n";
import { placeLinks, routeLinks } from "@/lib/maps.mjs";

type Point = { lat: number; lon: number };
type Place = { lat?: number; lon?: number; name?: string; query?: string; zoom?: number; googlePlaceId?: string };

const NAME = { google: "mapsGoogle", yandex: "mapsYandex", apple: "mapsApple" } as const;

export function MapLinks({ lang, place, route, label, title, children }: {
  lang: Lang;
  /** One place: searched by `query` near its point when given, otherwise pinned at its point. */
  place?: Place;
  /** A walk through these points, in order. */
  route?: Point[];
  /** The lead-in ("Open in", "Walk it in"). */
  label?: string;
  /** What the links open, for screen readers ("Castelo de São Jorge"). */
  title?: string;
  /** Extra links that belong on the same row (a Wikipedia article). */
  children?: ReactNode;
}) {
  const copy = strings(lang);
  const links = route ? routeLinks(route, lang) : place ? placeLinks(place, lang) : [];
  if (!links.length && !children) return null;
  const lead = label ?? copy.mapsOpenIn;
  return (
    <div className="map-links" role="group" aria-label={title ? `${lead}: ${title}` : lead}>
      {links.length ? <span className="map-links-lead">{lead}</span> : null}
      {links.map((link) => (
        <a
          key={`${link.service}-${link.from ?? 0}`}
          className={`map-link map-${link.service}`}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy[NAME[link.service]]}
          {link.from ? <span className="map-link-part"> {link.from}–{link.to}</span> : null}
        </a>
      ))}
      {children}
    </div>
  );
}
