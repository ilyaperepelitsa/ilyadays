import assert from "node:assert/strict";
import test from "node:test";
import { tripErrorKey } from "../../src/lib/trips/errors.mjs";

test("each form failure has its own sentence", () => {
  assert.equal(tripErrorKey("key"), "tripNeedKey");
  assert.equal(tripErrorKey("routes"), "tripErrRoutes");
  assert.equal(tripErrorKey("hours"), "tripErrHours");
  assert.equal(tripErrorKey("places"), "tripErrPlaces");
  assert.equal(tripErrorKey("food"), "tripErrFood");
  assert.equal(tripErrorKey("pace"), "tripErrPace");
  assert.equal(tripErrorKey("length"), "tripErrLength");
  assert.equal(tripErrorKey("nope"), "tripErrGeneric");
});
