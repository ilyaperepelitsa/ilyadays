import type { Metadata } from "next";
import { type Lang, localPath } from "./i18n";

export const SITE_URL = "https://ilyadays.com";
export const SITE_NAME = "ilyadays";

type PageMeta = {
  lang: Lang;
  /** Site path without the language prefix: "/", "/food/oyakodon". */
  path: string;
  title: string;
  description: string;
  /** Link-preview picture (1200×630), an absolute site path like "/share/home.jpg". */
  image: string;
  type?: "website" | "article";
  /** Use the title as is, without the " · ilyadays" suffix. */
  absoluteTitle?: boolean;
};

/** Canonical URL, EN/RU alternates and a link-preview card (Open Graph + Twitter) for one page. */
export function pageMetadata({ lang, path, title, description, image, type = "website", absoluteTitle }: PageMeta): Metadata {
  const url = localPath(lang, path);
  const images = [{ url: image, width: 1200, height: 630, alt: title }];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      languages: { en: localPath("en", path), ru: localPath("ru", path), "x-default": localPath("en", path) },
    },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title,
      description,
      locale: lang === "ru" ? "ru_RU" : "en_US",
      alternateLocale: lang === "ru" ? "en_US" : "ru_RU",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
