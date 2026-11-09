// Read only the public ilyadays table from the OLD backend. The generated SQL is imported into the NEW one.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

export function tripStateSQL(rows) {
  const seen = new Set();
  const values = rows.map((row) => {
    if (!/^[a-z0-9-]{1,64}$/.test(row.trip) || !/^[A-Za-z0-9_-]{1,64}$/.test(row.key)
      || row.value === undefined || row.value === null || !Number.isFinite(Date.parse(row.updated_at))) {
      throw new Error("Invalid trip_state row; export aborted");
    }
    const id = `${row.trip}:${row.key}`;
    if (seen.has(id)) throw new Error("Duplicate trip_state row; export aborted");
    seen.add(id);
    return `(${quote(row.trip)}, ${quote(row.key)}, ${quote(JSON.stringify(row.value))}::jsonb, ${quote(row.updated_at)}::timestamptz)`;
  });
  return `-- ilyadays trip progress: ${rows.length} rows. Import into the NEW project's SQL Editor only.\n`
    + "-- Freeze editing on the old site between the final export and cutover.\nBEGIN;\n"
    + (rows.length ? "INSERT INTO public.trip_state (trip, key, value, updated_at) VALUES\n"
      + values.join(",\n") + "\nON CONFLICT (trip, key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;\n" : "-- Source has no saved progress.\n")
    + "COMMIT;\n";
}

export function snapshotRows(snapshot, now = new Date().toISOString()) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("Expected a browser progress object");
  const keys = ["visited", "ideas", "dayOrder", "days", "tripStart"];
  const rows = keys.filter((key) => snapshot[key] != null).map((key) => ({ trip: "istanbul", key, value: snapshot[key], updated_at: now }));
  if (!rows.length) throw new Error("The browser snapshot contains no Istanbul progress");
  return rows;
}

async function main() {
  const outFlag = process.argv.indexOf("--out");
  const out = outFlag >= 0 ? process.argv[outFlag + 1] : "output/supabase-cutover/trip-state.sql";
  if (!out || out.startsWith("--")) throw new Error("--out needs a file path");
  const snapshotFlag = process.argv.indexOf("--snapshot");
  if (snapshotFlag >= 0) {
    const file = process.argv[snapshotFlag + 1];
    if (!file || file.startsWith("--")) throw new Error("--snapshot needs a JSON file path");
    const rows = snapshotRows(JSON.parse(await readFile(file, "utf8")));
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, tripStateSQL(rows));
    console.log(`Exported ${rows.length} browser progress keys to ${out}. Review before importing.`);
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Load the OLD project's URL and public key with node --env-file=.env.local");
  const rows = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const endpoint = new URL("/rest/v1/trip_state", url);
    endpoint.search = new URLSearchParams({ select: "trip,key,value,updated_at", order: "trip.asc,key.asc", limit: String(size), offset: String(offset) }).toString();
    const headers = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(`Source trip_state returned HTTP ${response.status}${body.code === "PGRST205" ? " (trip_state missing from the schema cache; see browser recovery in docs/supabase-cutover.md)" : ""}; no export written`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Unexpected source response; no export written");
    rows.push(...page);
    if (page.length < size) break;
  }
  const sql = tripStateSQL(rows);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, sql);
  console.log(`Exported ${rows.length} trip_state rows to ${out}. No source data was changed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
