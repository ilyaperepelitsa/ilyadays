import { type Lang, prefix } from "./i18n";

/** A picture path from the recipe export, served under /media. */
export const media = (p: string) => `/media/${p}`;

/** Recipe-site URL of a slug in a language ("index" → the food index). */
export const foodHref = (lang: Lang, slug = "index") =>
  `${prefix(lang)}/food${slug === "index" ? "" : `/${slug}`}`;
