// Per-page metadata (title, canonical, EN/RU alternates, link-preview card), shared by the EN and RU routes.
import type { Metadata } from "next";
import { getFoodIndex, getRecipe, getSousVide, media, recipeSlugs } from "@/lib/content";
import { type Lang, strings } from "@/lib/i18n";
import { pageMetadata } from "@/lib/metadata";

export const homeMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({ lang, path: "/", title: t.siteTitle, absoluteTitle: true, description: t.homeDescription, image: "/share/home.jpg" });
};

export const foodMeta = (lang: Lang): Metadata => {
  const i = getFoodIndex(lang);
  return pageMetadata({ lang, path: "/food", title: i.title, description: i.description, image: media(i.share_image) });
};

export const recipeMeta = (lang: Lang, slug: string): Metadata => {
  const r = getRecipe(lang, slug);
  if (!r) return {};
  return pageMetadata({
    lang,
    path: `/food/${slug}`,
    title: r.title,
    description: r.description,
    image: media(r.share_image),
    type: "article",
  });
};

export const sousVideMeta = (lang: Lang): Metadata => {
  const s = getSousVide(lang);
  return pageMetadata({ lang, path: "/food/sous-vide", title: s.title, description: s.description, image: media(s.share_image) });
};

export const travelMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({ lang, path: "/travel", title: t.travelTitle, description: t.travelDescription, image: "/share/travel.jpg" });
};

export const makeTripMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({ lang, path: "/travel/new", title: t.makeTripTitle, description: t.makeTripDescription, image: "/share/travel.jpg" });
};

export const istanbulMeta = (lang: Lang): Metadata => {
  const t = strings(lang);
  return pageMetadata({
    lang,
    path: "/travel/istanbul",
    title: t.istanbulPageTitle,
    description: t.istanbulDescription,
    image: "/share/travel.jpg",
  });
};

/** Recipe pages to prerender (the sous-vide tables have their own route). */
export const recipeParams = () => recipeSlugs().map((slug) => ({ slug }));
