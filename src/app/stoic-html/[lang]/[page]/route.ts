import { readFile } from "node:fs/promises";
import path from "node:path";
import { STOIC_PAGES, isStoicRoute, localize, stoicRoutes, type StoicLang } from "@/lib/stoic-seo.mjs";

// The static Stoic pages with their head for one language (src/lib/stoic-seo.mjs). Built once at build time from the files in
// public/apps/; next.config.ts rewrites each page's own URL here (beforeFiles), so the browser stays on /apps/….
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return stoicRoutes();
}

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string; page: string }> }) {
  const { lang, page } = await params;
  if (!isStoicRoute(lang, page)) return new Response("Not found", { status: 404 });
  const entry = STOIC_PAGES[page], language = lang as StoicLang;
  // Read only while building. turbopackIgnore keeps the tracer from copying all of public/apps (about 31 MB) into the
  // route's server function, which never runs on a deployment (every pair is prerendered, dynamicParams is false).
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "apps");
  const read = (file: string) => readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir, file), "utf8");
  const html = await read(entry.file);
  const dataFile = entry.data?.[language];
  const data = dataFile ? JSON.parse(await read(dataFile)) : undefined;
  return new Response(localize(html, page, language, data), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
