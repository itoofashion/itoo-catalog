import { describe, expect, it } from "vitest";
import {
  buildCatalogQuery,
  EMPTY_SELECTION,
  isEmptySelection,
  NO_FILTERS,
  parseCatalogQuery,
  selectionSize,
} from "./share";

describe("buildCatalogQuery", () => {
  it("carries hand-picked styles", () => {
    expect(buildCatalogQuery({ categories: [], skus: ["Y-542", "21034"] })).toBe(
      "?items=Y-542%2C21034",
    );
  });

  it("carries whole categories", () => {
    expect(buildCatalogQuery({ categories: ["Tops", "Pants"], skus: [] })).toBe(
      "?cats=Tops%2CPants",
    );
  });

  it("carries both at once", () => {
    const query = buildCatalogQuery({ categories: ["Tops"], skus: ["Y-542"] });
    expect(query).toContain("cats=Tops");
    expect(query).toContain("items=Y-542");
  });

  it("puts the open filters in the address, so it can just be copied", () => {
    const query = buildCatalogQuery(EMPTY_SELECTION, {
      category: "Dresses",
      newOnly: true,
    });
    expect(query).toBe("?show=Dresses&new=1");
  });

  it("leaves All out — it is the absence of a filter", () => {
    expect(buildCatalogQuery(EMPTY_SELECTION, { category: "All", newOnly: false })).toBe("");
  });

  it("is empty for the plain catalog", () => {
    expect(buildCatalogQuery(EMPTY_SELECTION, NO_FILTERS)).toBe("");
  });
});

describe("parseCatalogQuery", () => {
  it("round-trips a selection and its filters", () => {
    const selection = { categories: ["Tops"], skus: ["Y-542", "21034"] };
    const filters = { category: "Tops", newOnly: true };
    const parsed = parseCatalogQuery(new URLSearchParams(buildCatalogQuery(selection, filters)));

    expect(parsed.selection).toEqual(selection);
    expect(parsed.filters).toEqual(filters);
  });

  it("reads Next.js style search params", () => {
    const { selection, filters } = parseCatalogQuery({ cats: "Tops", new: "1" });
    expect(selection.categories).toEqual(["Tops"]);
    expect(filters.newOnly).toBe(true);
  });

  it("ignores blanks and stray whitespace", () => {
    const { selection } = parseCatalogQuery({ items: " Y-542 , ,21034," });
    expect(selection.skus).toEqual(["Y-542", "21034"]);
  });

  it("falls back to the whole catalog when nothing is asked for", () => {
    const parsed = parseCatalogQuery({});
    expect(parsed.selection).toEqual(EMPTY_SELECTION);
    expect(parsed.filters).toEqual(NO_FILTERS);
  });

  it("treats a stray All the same as no filter", () => {
    expect(parseCatalogQuery({ show: "All" }).filters.category).toBeNull();
  });
});

describe("selection helpers", () => {
  it("knows when nothing is picked", () => {
    expect(isEmptySelection(EMPTY_SELECTION)).toBe(true);
    expect(isEmptySelection({ categories: ["Tops"], skus: [] })).toBe(false);
  });

  it("counts categories and styles together", () => {
    expect(selectionSize({ categories: ["Tops", "Pants"], skus: ["Y-542"] })).toBe(3);
  });
});
