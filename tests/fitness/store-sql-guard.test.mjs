// The fitness migration refuses a project without public.ilyadays_admins, whose public.is_admin() would be another app's
// (the shared Typekana project: its admins would gate fitness writes, and the first of them could become the owner).
// Runs on a throwaway local Postgres like tests/fitness/sql.test.mjs; skipped when no Postgres server binaries are
// installed (set PGBIN to a Postgres 15+ bin directory).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const pgbin = process.env.PGBIN || "/opt/homebrew/opt/postgresql@17/bin";
const available = fs.existsSync(path.join(pgbin, "initdb")) && fs.existsSync(path.join(pgbin, "pg_ctl"));
const migration = (name) => path.join(root, "supabase/migrations", name);
/** The server's socket lives in the work directory: Unix socket paths are limited to about 100 bytes. */
const shortEnough = (dir) => path.join(dir, "fit-guard-XXXXXX", ".s.PGSQL.00000").length < 100;

describe("fitness migration guard", () => {
  it("refuses to install where is_admin() belongs to another app, and installs after the ilyadays admin migration", { skip: available ? false : `no Postgres at ${pgbin}`, timeout: 120_000 }, () => {
    const work = fs.mkdtempSync(path.join(shortEnough(os.tmpdir()) ? os.tmpdir() : "/tmp", "fit-guard-"));
    const port = String(55000 + (process.pid % 900));
    const run = (bin, args) => spawnSync(path.join(pgbin, bin), args, { encoding: "utf8" });
    const psql = (...args) => run("psql", ["-X", "-h", work, "-p", port, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", ...args]);
    try {
      assert.equal(run("initdb", ["-D", path.join(work, "data"), "-U", "postgres", "-A", "trust"]).status, 0);
      const started = run("pg_ctl", ["-D", path.join(work, "data"), "-o", `-p ${port} -k ${work} -c listen_addresses=''`, "-l", path.join(work, "log"), "-w", "start"]);
      assert.equal(started.status, 0, started.stderr);
      assert.equal(psql("-f", path.join(root, "tests/fitness/sql/supabase-stub.sql")).status, 0);
      // Another app's admin check, without public.ilyadays_admins (like Typekana's).
      assert.equal(psql("-c", "CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$").status, 0);

      const refused = psql("-f", migration("20261108120000_fitness.sql"));
      assert.notEqual(refused.status, 0, "the migration must stop");
      assert.match(refused.stderr, /Run 20261006110000_ilyadays_admin\.sql first/);
      const left = psql("-At", "-c", "SELECT count(*) FROM pg_class WHERE relname LIKE 'fitness_%'");
      assert.equal(left.stdout.trim(), "0", "nothing installed");

      // A dedicated project: the admin migration first, then fitness installs (and again: idempotent).
      assert.equal(psql("-c", "DROP FUNCTION public.is_admin()").status, 0);
      assert.equal(psql("-f", migration("20261006110000_ilyadays_admin.sql")).status, 0);
      for (let i = 0; i < 2; i += 1) {
        const applied = psql("-f", migration("20261108120000_fitness.sql"));
        assert.equal(applied.status, 0, applied.stderr);
      }
      assert.equal(psql("-At", "-c", "SELECT to_regclass('public.fitness_sets') IS NOT NULL").stdout.trim(), "t");
    } finally {
      run("pg_ctl", ["-D", path.join(work, "data"), "-m", "immediate", "stop"]);
      fs.rmSync(work, { recursive: true, force: true });
    }
  });
});
