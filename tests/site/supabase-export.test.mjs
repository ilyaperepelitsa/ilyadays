import assert from "node:assert/strict";
import test from "node:test";
import { snapshotRows, tripStateSQL } from "../../scripts/export-trip-state.mjs";

const row = { trip: "istanbul", key: "days", value: { title: "Ilya's walk; DROP TABLE x; --", ru: "Прогулка", lines: "one\ntwo" }, updated_at: "2026-11-08T12:00:00Z" };

test("progress export preserves JSON, quotes SQL strings and upserts without deleting data", () => {
  const sql = tripStateSQL([row]);
  assert.ok(sql.includes("Ilya''s walk; DROP TABLE x; --"));
  assert.ok(sql.includes("Прогулка"));
  const jsonLiteral = sql.match(/'((?:[^']|'')*)'::jsonb/)[1];
  assert.deepEqual(JSON.parse(jsonLiteral.replaceAll("''", "'")), row.value);
  assert.ok(sql.includes("ON CONFLICT (trip, key) DO UPDATE"));
  assert.ok(sql.endsWith("COMMIT;\n"));
});

test("export fails closed for malformed or duplicate rows", () => {
  for (const patch of [{ trip: "x');drop table x;--" }, { key: "bad key" }, { value: null }, { value: undefined }, { updated_at: "bad" }]) {
    assert.throws(() => tripStateSQL([{ ...row, ...patch }]), /Invalid/);
  }
  assert.throws(() => tripStateSQL([row, row]), /Duplicate/);
  assert.ok(!tripStateSQL([]).includes("INSERT INTO"));
});

test("browser recovery takes only the five owner-data keys, preserving empty values", () => {
  const rows = snapshotRows({ visited: {}, ideas: [], tripStart: "", ai: { key: "never-export" }, scenario: "2d" }, row.updated_at);
  assert.deepEqual(rows.map((r) => r.key), ["visited", "ideas", "tripStart"]);
  assert.ok(rows.every((r) => r.trip === "istanbul" && r.updated_at === row.updated_at));
  assert.ok(!tripStateSQL(rows).includes("never-export"));
  assert.throws(() => snapshotRows({ ai: {} }), /no Istanbul progress/);
  assert.throws(() => snapshotRows([]), /Expected/);
});
