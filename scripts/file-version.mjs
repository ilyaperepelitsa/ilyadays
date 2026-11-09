/** The cache-busting `?v=` of a file: the first ten hex digits of its SHA-1, as scripts/optimize-media.py writes them.
 *  Build-time only (Node). Files whose URL carries it are cached for a year; a new file means a new URL. */
import { createHash } from "node:crypto";
import fs from "node:fs";

/**
 * @param {string} file absolute path
 */
export function fileVersion(file) {
  return createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
}

/**
 * Every `<media path>?v=<hash>` the content JSON refers to, keyed by the path under public/media.
 * @param {string} contentDir
 * @returns {Map<string, string>}
 */
export function contentMediaVersions(contentDir) {
  /** @type {Map<string, string>} */
  const versions = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) {
        for (const match of fs.readFileSync(full, "utf8").matchAll(/"(?:\/media\/)?([A-Za-z0-9_.\/-]+\.(?:webp|jpe?g|png|svg|pdf))\?v=([0-9a-f]{6,40})"/g)) {
          versions.set(match[1], match[2]);
        }
      }
    }
  };
  walk(contentDir);
  return versions;
}
