#!/usr/bin/env node
// No-cookie audit of the production build. Run after `npm run build`:
//   npm run check:cookies            scan the browser bundles + prerendered pages
//   npm run check:cookies -- --live  also request every page from `next start` (localhost:3000) and check headers
//
// Fails if code that ships to the browser WRITES document.cookie, or if any response sends Set-Cookie.
// Reads of document.cookie inside library code are listed so they can be reviewed, but don't fail the check.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scanDirs = [path.join(ROOT, ".next/static"), path.join(ROOT, ".next/server/app"), path.join(ROOT, "public/apps")];
const WRITE = /document\.cookie\s*=(?!=)/g;
const ANY = /document\.cookie|set-cookie/gi;

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p) : /\.(js|mjs|html|rsc|body|meta|json)$/.test(e.name) ? [p] : [];
      })
    : [];

let writes = 0;
const mentions = [];
for (const file of scanDirs.flatMap(walk)) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  for (const m of src.matchAll(WRITE)) {
    writes++;
    console.error(`WRITE ${rel}: …${src.slice(Math.max(0, m.index - 80), m.index + 60).replace(/\s+/g, " ")}…`);
  }
  for (const m of src.matchAll(ANY)) mentions.push(`${rel}: …${src.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")}…`);
}
if (fs.existsSync(path.join(ROOT, ".next/server/middleware.js"))) {
  console.error("A middleware is built — this app should have none.");
  writes++;
}
console.log(`${mentions.length} mention(s) of document.cookie / Set-Cookie in the build:`);
mentions.forEach((m) => console.log("  " + m));

if (process.argv.includes("--live")) {
  const base = "http://localhost:3000";
  const pages = ["/", "/ru", "/food", "/food/oyakodon", "/food/sous-vide", "/travel", "/travel/istanbul", "/ru/food/ramen",
    "/food/oyakodon.html", "/nope", "/manifest.webmanifest", "/media/share/oyakodon.jpg", "/apps/istanbul/app.js"];
  for (const p of pages) {
    const res = await fetch(base + p, { redirect: "manual" });
    const sc = res.headers.get("set-cookie");
    console.log(`${res.status} ${p}${sc ? `  SET-COOKIE: ${sc}` : ""}`);
    if (sc) writes++;
  }
}

if (writes) {
  console.error(`✗ ${writes} cookie write(s) / Set-Cookie header(s) found`);
  process.exit(1);
}
console.log("✓ no cookie writes, no Set-Cookie");
