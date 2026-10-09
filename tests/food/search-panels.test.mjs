import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openSearchPanels } from "../../src/lib/food/search-panels.mjs";

describe("search panels", () => {
  it("stays closed until a query or an ingredient is already chosen", () => {
    assert.deepEqual(openSearchPanels("", []), { search: false, ingredients: false });
    assert.deepEqual(openSearchPanels("  ikura  ", []), { search: true, ingredients: false });
    assert.deepEqual(openSearchPanels("", ["soy-sauce"]), { search: false, ingredients: true });
  });

  it("rejects a missing query", () => {
    assert.throws(() => openSearchPanels(undefined, []), TypeError);
  });
});
