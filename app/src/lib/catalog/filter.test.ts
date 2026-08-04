import { describe, expect, it } from "vitest";
import { categoriesOf, filterProducts } from "./filter";
import type { Product } from "./types";

const now = new Date("2026-08-04T12:00:00Z");

function product(overrides: Partial<Product> & { sku: string }): Product {
  return {
    name: "Sample",
    price: 19.75,
    category: "Tops",
    colors: ["Beige"],
    images: [],
    createdAt: "2026-01-01T00:00:00Z",
    sourceId: 1,
    ...overrides,
  };
}

const catalog = [
  product({ sku: "A-1", category: "Tops", createdAt: "2026-08-01T00:00:00Z" }),
  product({ sku: "A-2", category: "Dresses", createdAt: "2026-01-01T00:00:00Z" }),
  product({ sku: "A-3", category: "Dresses", createdAt: "2026-07-30T00:00:00Z" }),
];

describe("categoriesOf", () => {
  it("lists the categories in use, All first", () => {
    expect(categoriesOf(catalog)).toEqual(["All", "Dresses", "Tops"]);
  });

  it("never repeats a category", () => {
    expect(categoriesOf([...catalog, ...catalog])).toEqual([
      "All",
      "Dresses",
      "Tops",
    ]);
  });

  it("returns just All for an empty catalog", () => {
    expect(categoriesOf([])).toEqual(["All"]);
  });
});

describe("filterProducts", () => {
  it("returns everything when nothing is selected", () => {
    expect(filterProducts(catalog, { skus: [], category: null }, now)).toHaveLength(3);
  });

  it("filters by category", () => {
    const result = filterProducts(catalog, { skus: [], category: "Dresses" }, now);
    expect(result.map((p) => p.sku)).toEqual(["A-2", "A-3"]);
  });

  it("treats All as no category filter", () => {
    expect(filterProducts(catalog, { skus: [], category: "All" }, now)).toHaveLength(3);
  });

  it("keeps only hand-picked items", () => {
    const result = filterProducts(catalog, { skus: ["A-1", "A-3"], category: null }, now);
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });

  it("ignores picked SKUs that are no longer in the catalog", () => {
    const result = filterProducts(catalog, { skus: ["A-1", "GONE"], category: null }, now);
    expect(result.map((p) => p.sku)).toEqual(["A-1"]);
  });

  it("combines a picked set with a category", () => {
    const result = filterProducts(
      catalog,
      { skus: ["A-1", "A-3"], category: "Dresses" },
      now,
    );
    expect(result.map((p) => p.sku)).toEqual(["A-3"]);
  });

  it("shows only new arrivals when asked", () => {
    const result = filterProducts(
      catalog,
      { skus: [], category: null, newOnly: true },
      now,
    );
    expect(result.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
  });
});
