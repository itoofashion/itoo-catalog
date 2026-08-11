import { describe, expect, it } from "vitest";
import { categoriesOf, filterProducts, isSelected, selectedProducts } from "./filter";
import type { PublicProduct } from "./public";
import { EMPTY_SELECTION, NO_FILTERS } from "./share";

function product(overrides: Partial<PublicProduct> & { sku: string }): PublicProduct {
  return {
    name: "Sample",
    price: 19.75,
    category: "Tops",
    colors: [],
    images: [],
    sizes: ["S", "M", "L"],
    packBreakdown: [2, 2, 2],
    minimumUnits: 6,
    isNew: false,
    isHidden: false,
    ...overrides,
  };
}

const catalog = [
  product({ sku: "A-1", category: "Tops", isNew: true, name: "Romantic Lace Top" }),
  product({ sku: "A-2", category: "Dresses", name: "Wrap Dress" }),
  product({ sku: "A-3", category: "Dresses", isNew: true, name: "Lace Midi Dress" }),
];

describe("categoriesOf", () => {
  it("lists the categories in use, All first", () => {
    expect(categoriesOf(catalog)).toEqual(["All", "Dresses", "Tops"]);
  });

  it("never repeats a category", () => {
    expect(categoriesOf([...catalog, ...catalog])).toEqual(["All", "Dresses", "Tops"]);
  });

  it("returns just All for an empty catalog", () => {
    expect(categoriesOf([])).toEqual(["All"]);
  });
});

describe("isSelected", () => {
  it("counts a style picked on its own", () => {
    expect(isSelected(catalog[0], { categories: [], skus: ["A-1"] })).toBe(true);
  });

  it("counts a style picked through its category", () => {
    expect(isSelected(catalog[1], { categories: ["Dresses"], skus: [] })).toBe(true);
  });

  it("leaves out everything else", () => {
    expect(isSelected(catalog[0], { categories: ["Dresses"], skus: [] })).toBe(false);
  });
});

describe("selectedProducts", () => {
  it("is the whole catalog when nothing is picked", () => {
    expect(selectedProducts(catalog, EMPTY_SELECTION)).toHaveLength(3);
  });

  it("keeps the styles that were picked", () => {
    const result = selectedProducts(catalog, { categories: [], skus: ["A-1", "A-3"] });
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });

  it("keeps everything in a picked category", () => {
    const result = selectedProducts(catalog, { categories: ["Dresses"], skus: [] });
    expect(result.map((p) => p.sku)).toEqual(["A-2", "A-3"]);
  });

  it("takes a category link to mean the category, not the styles it held", () => {
    // A dress added after the link was sent is in the link too.
    const later = [...catalog, product({ sku: "A-4", category: "Dresses" })];
    const result = selectedProducts(later, { categories: ["Dresses"], skus: [] });
    expect(result.map((p) => p.sku)).toContain("A-4");
  });

  it("combines categories with individually picked styles", () => {
    const result = selectedProducts(catalog, { categories: ["Tops"], skus: ["A-2"] });
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-2"]);
  });

  it("ignores styles that are no longer in the catalog", () => {
    const result = selectedProducts(catalog, { categories: [], skus: ["A-1", "GONE"] });
    expect(result.map((p) => p.sku)).toEqual(["A-1"]);
  });
});

describe("filterProducts", () => {
  it("returns everything with no filters", () => {
    expect(filterProducts(catalog, NO_FILTERS)).toHaveLength(3);
  });

  it("narrows to a category", () => {
    const result = filterProducts(catalog, { category: "Dresses", newOnly: false });
    expect(result.map((p) => p.sku)).toEqual(["A-2", "A-3"]);
  });

  it("treats All as no filter", () => {
    expect(filterProducts(catalog, { category: "All", newOnly: false })).toHaveLength(3);
  });

  it("narrows to new arrivals", () => {
    const result = filterProducts(catalog, { category: null, newOnly: true });
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });

  it("applies both together", () => {
    const result = filterProducts(catalog, { category: "Dresses", newOnly: true });
    expect(result.map((p) => p.sku)).toEqual(["A-3"]);
  });

  it("searches names, wherever in the name the words are", () => {
    const result = filterProducts(catalog, { ...NO_FILTERS, query: "lace" });
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });

  it("searches style numbers too", () => {
    const result = filterProducts(catalog, { ...NO_FILTERS, query: "a-2" });
    expect(result.map((p) => p.sku)).toEqual(["A-2"]);
  });

  it("reads a search without caring about case", () => {
    const result = filterProducts(catalog, { ...NO_FILTERS, query: "LACE" });
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });

  it("ignores the spaces around a search", () => {
    const result = filterProducts(catalog, { ...NO_FILTERS, query: "  wrap  " });
    expect(result.map((p) => p.sku)).toEqual(["A-2"]);
  });

  it("narrows a category with a search, not instead of one", () => {
    const result = filterProducts(catalog, {
      ...NO_FILTERS,
      category: "Dresses",
      query: "lace",
    });
    expect(result.map((p) => p.sku)).toEqual(["A-3"]);
  });
});
