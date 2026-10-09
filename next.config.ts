import type { NextConfig } from "next";

// Old static-site URLs (ilyadays.com/food/*.html etc.) keep working: permanent 301s to the new routes.
const legacy = [
  { source: "/index.html", destination: "/" },
  { source: "/food/index.html", destination: "/food" },
  { source: "/travel/index.html", destination: "/travel" },
  { source: "/travel/istanbul/index.html", destination: "/travel/istanbul" },
  { source: "/food/:slug([a-z0-9-]+)\\.html", destination: "/food/:slug" },
  // Pictures and the PDF moved from /food/<dir> to /media/<dir>; old link previews point at /food/share/*.jpg.
  { source: "/food/:dir(illustrations|share|assets|photos)/:path*", destination: "/media/:dir/:path*" },
  { source: "/food/icons/:path*", destination: "/icons/:path*" },
  // English lives at the root; /en/* is never a page.
  { source: "/en", destination: "/" },
  { source: "/en/:path*", destination: "/:path*" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: {
    globalNotFound: true,
    optimizePackageImports: ["@supabase/supabase-js"],
  },

  async redirects() {
    return legacy.map((r) => ({ ...r, statusCode: 301 as const }));
  },

  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];
    // Pictures keep their names when regenerated, so cache them for a day, not forever.
    const media = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/(.*)", headers: security },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/offline-catalog.json", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/offline-assets.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/media/:path*", headers: media },
      { source: "/covers/:path*", headers: media },
      { source: "/share/:path*", headers: media },
      { source: "/icons/:path*", headers: media },
    ];
  },
};

export default nextConfig;
