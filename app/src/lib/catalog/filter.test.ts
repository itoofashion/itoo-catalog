import { describe, expect, it } from "vitest";
import { categoriesOf, filterProducts } from "./filter";
import type { PublicProduct } from "./public";

function product(overrides: Partial<PublicProduct> & { sku: string }): PublicProduct {
  return {
    name: "Sample",
    price: 19.75,
    category: "Tops",
    colors: [],
    images: [],
    isNew: false,
    ...overrides,
  };
}

const catalog = [
  product({ sku: "A-1", category: "Tops", isNew: true }),
  product({ sku: "A-2", category: "Dresses" }),
  product({ sku: "A-3", category: "Dresses", isNew: true }),
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

describe("filterProducts", () => {
  it("returns everything when nothing is selected", () => {
    expect(filterProducts(catalog, { skus: [], category: null })).toHaveLength(3);
  });

  it("filters by category", () => {
    const result = filterProducts(catalog, { skus: [], category: "Dresses" });
    expect(result.map((p) => p.sku)).toEqual(["A-2", "A-3"]);
  });

  it("treats All as no category filter", () => {
    expect(filterProducts(catalog, { skus: [], category: "All" })).toHaveLength(3);
  });

  it("keeps only hand-picked items", () => {
    const result = filterProducts(catalog, { skus: ["A-1", "A-3"], category: null });
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });

  it("ignores picked SKUs that are no longer in the catalog", () => {
    const result = filterProducts(catalog, { skus: ["A-1", "GONE"], category: null });
    expect(result.map((p) => p.sku)).toEqual(["A-1"]);
  });

  it("combines a picked set with a category", () => {
    const result = filterProducts(catalog, { skus: ["A-1", "A-3"], category: "Dresses" });
    expect(result.map((p) => p.sku)).toEqual(["A-3"]);
  });

  it("shows only new arrivals when asked", () => {
    const result = filterProducts(catalog, { skus: [], category: null, newOnly: true });
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });
});
