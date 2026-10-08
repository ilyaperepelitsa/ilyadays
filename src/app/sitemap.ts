import type { MetadataRoute } from "next";
import { recipeSlugs } from "@/lib/content";
import { localPath } from "@/lib/i18n";
import { SITE_URL } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/food", "/food/sous-vide", ...recipeSlugs().map((s) => `/food/${s}`), "/travel", "/travel/istanbul", "/travel/new"];
  return paths.map((p) => ({
    url: `${SITE_URL}${localPath("en", p)}`,
    alternates: { languages: { en: `${SITE_URL}${localPath("en", p)}`, ru: `${SITE_URL}${localPath("ru", p)}` } },
  }));
}
