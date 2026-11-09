// Runs the fitness migrations and the 30 RLS checks on a throwaway local Postgres (scripts/fitness-sql-check.sh).
// Skipped when no Postgres server binaries are installed (CI, other machines): set PGBIN to a Postgres 15+ bin directory.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const pgbin = process.env.PGBIN || "/opt/homebrew/opt/postgresql@17/bin";
const available = fs.existsSync(path.join(pgbin, "initdb")) && fs.existsSync(path.join(pgbin, "pg_ctl"));

describe("fitness database migration", () => {
  it("applies twice and passes every row-level-security check", { skip: available ? false : `no Postgres at ${pgbin}`, timeout: 120_000 }, () => {
    const port = String(54400 + (process.pid % 500));
    const run = spawnSync("bash", [path.join(root, "scripts/fitness-sql-check.sh")], {
      encoding: "utf8",
      env: { ...process.env, PGBIN: pgbin, PGPORT_CHECK: port },
    });
    const out = `${run.stdout}\n${run.stderr}`;
    assert.equal(run.status, 0, out.slice(-3000));
    assert.match(out, /fitness SQL checks passed/);
    const passed = out.split("\n").filter((line) => line.startsWith("ok   ")).length;
    assert.ok(passed >= 30, `expected at least 30 passing checks, saw ${passed}\n${out.slice(-2000)}`);
    assert.doesNotMatch(out, /FAIL /);
  });
});
