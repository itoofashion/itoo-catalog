import { describe, expect, it } from "vitest";
import {
  buildCatalogQuery,
  EMPTY_SELECTION,
  isEmptySelection,
  NO_FILTERS,
  parseCatalogQuery,
  selectionSize,
  toggleCategory,
  toggleStyle,
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
      page: 1,
    });
    expect(query).toBe("?show=Dresses&new=1");
  });

  it("leaves All out, because it is the absence of a filter", () => {
    expect(
      buildCatalogQuery(EMPTY_SELECTION, { category: "All", newOnly: false, page: 1 }),
    ).toBe("");
  });

  it("carries the page, and leaves the first one out", () => {
    expect(buildCatalogQuery(EMPTY_SELECTION, { ...NO_FILTERS, page: 3 })).toBe("?page=3");
    expect(buildCatalogQuery(EMPTY_SELECTION, { ...NO_FILTERS, page: 1 })).toBe("");
  });

  it("carries the search, and leaves an empty one out", () => {
    expect(buildCatalogQuery(EMPTY_SELECTION, { ...NO_FILTERS, query: "lace" })).toBe(
      "?q=lace",
    );
    expect(buildCatalogQuery(EMPTY_SELECTION, { ...NO_FILTERS, query: null })).toBe("");
  });

  it("is empty for the plain catalog", () => {
    expect(buildCatalogQuery(EMPTY_SELECTION, NO_FILTERS)).toBe("");
  });
});

describe("parseCatalogQuery", () => {
  it("round-trips a selection and its filters", () => {
    const selection = { categories: ["Tops"], skus: ["Y-542", "21034"] };
    const filters = { category: "Tops", newOnly: true, page: 2, query: "lace" };
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

  it("reads a page number, and ignores a nonsensical one", () => {
    expect(parseCatalogQuery({ page: "4" }).filters.page).toBe(4);
    expect(parseCatalogQuery({ page: "0" }).filters.page).toBe(1);
    expect(parseCatalogQuery({ page: "junk" }).filters.page).toBe(1);
  });

  it("reads a search, and treats a blank one as none", () => {
    expect(parseCatalogQuery({ q: "lace top" }).filters.query).toBe("lace top");
    expect(parseCatalogQuery({ q: "   " }).filters.query).toBeNull();
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

describe("ticking a category", () => {
  /** What the catalog holds, as the caller reads it off the products. */
  const PANTS = ["P-1", "P-2"];

  it("swallows styles of that category that were picked one by one", () => {
    const before = { categories: [], skus: ["P-1"] };
    expect(toggleCategory(before, "Pants", PANTS)).toEqual({
      categories: ["Pants"],
      skus: [],
    });
  });

  it("leaves styles of other categories alone", () => {
    const before = { categories: [], skus: ["P-1", "T-9"] };
    expect(toggleCategory(before, "Pants", PANTS)).toEqual({
      categories: ["Pants"],
      skus: ["T-9"],
    });
  });

  it("takes what it swallowed away with it when it is unticked", () => {
    const picked = toggleCategory({ categories: [], skus: ["P-1"] }, "Pants", PANTS);
    expect(toggleCategory(picked, "Pants", PANTS)).toEqual(EMPTY_SELECTION);
  });

  it("does not release a style back when another category is unticked", () => {
    let selection = toggleCategory({ categories: [], skus: ["P-1"] }, "Pants", PANTS);
    selection = toggleCategory(selection, "Tops", ["T-9"]);
    expect(toggleCategory(selection, "Tops", ["T-9"])).toEqual({
      categories: ["Pants"],
      skus: [],
    });
  });

  it("stops the same style being counted twice", () => {
    const before = { categories: [], skus: ["P-1"] };
    expect(selectionSize(toggleCategory(before, "Pants", PANTS))).toBe(1);
  });

  it("keeps the link free of styles the category already covers", () => {
    const selection = toggleCategory({ categories: [], skus: ["P-1"] }, "Pants", PANTS);
    expect(buildCatalogQuery(selection)).toBe("?cats=Pants");
  });
});

describe("ticking a single style", () => {
  it("adds one and removes one", () => {
    const added = toggleStyle(EMPTY_SELECTION, "Y-542");
    expect(added.skus).toEqual(["Y-542"]);
    expect(toggleStyle(added, "Y-542").skus).toEqual([]);
  });

  it("leaves the picked categories untouched", () => {
    const selection = toggleStyle({ categories: ["Tops"], skus: [] }, "P-1");
    expect(selection.categories).toEqual(["Tops"]);
  });
});
