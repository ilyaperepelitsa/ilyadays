import type { MetadataRoute } from "next";
import { recipeSlugs } from "@/lib/content";
import { localPath } from "@/lib/i18n";
import { SITE_URL } from "@/lib/metadata";
import fs from "node:fs";
import path from "node:path";
import { EXERCISES } from "@/lib/fitness/catalog.mjs";

/** Science topics that have an English page (content/fitness/science/<slug>.en.md). */
function scienceTopics(): string[] {
  const dir = path.join(process.cwd(), "content/fitness/science");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".en.md")).map((f) => f.slice(0, -6)).sort() : [];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/food", "/food/sous-vide", ...recipeSlugs().map((s) => `/food/${s}`), "/travel", "/travel/turkey-yacht-food", "/travel/istanbul", "/travel/new", "/fitness", "/fitness/train", "/fitness/program", "/fitness/profile", "/fitness/exercises", "/fitness/gyms", "/fitness/progress", "/fitness/science", "/fitness/nutrition", "/fitness/tools",
    ...(EXERCISES as { id: string }[]).map((e) => `/fitness/exercises/${e.id}`), ...scienceTopics().map((t) => `/fitness/science/${t}`)];
  return paths.map((p) => ({
    url: `${SITE_URL}${localPath("en", p)}`,
    alternates: { languages: { en: `${SITE_URL}${localPath("en", p)}`, ru: `${SITE_URL}${localPath("ru", p)}` } },
  }));
}
