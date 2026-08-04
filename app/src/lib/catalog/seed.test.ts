import { describe, expect, it } from "vitest";
import { categoriesOf } from "./filter";
import { seedCatalog, seedProducts } from "./seed";
import { UNCATEGORIZED } from "@/lib/fashiongo/map";

/**
 * These run against the real FashionGo export in src/data. They are the guard
 * that the mapping still fits the vendor's actual data, not just handmade cases.
 */
describe("seed catalog", () => {
  const products = seedProducts();

  it("contains the pilot's products", () => {
    expect(products.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every product a style number, a name and a photo", () => {
    for (const product of products) {
      expect(product.sku, "sku").toBeTruthy();
      expect(product.name, `name of ${product.sku}`).toBeTruthy();
      expect(product.images.length, `photos of ${product.sku}`).toBeGreaterThan(0);
    }
  });

  it("prices every product above zero and below the FashionGo price", () => {
    for (const product of products) {
      expect(product.price, `price of ${product.sku}`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate style numbers", () => {
    const skus = products.map((p) => p.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("resolves a real category for every product", () => {
    const uncategorized = products.filter((p) => p.category === UNCATEGORIZED);
    expect(uncategorized.map((p) => p.sku)).toEqual([]);
  });

  it("covers more than one category, so filtering is demonstrable", () => {
    expect(categoriesOf(products).length).toBeGreaterThan(2);
  });

  it("serves photos over https from the FashionGo CDN", () => {
    for (const product of products) {
      for (const image of product.images) {
        expect(image.url, `photo of ${product.sku}`).toMatch(
          /^https:\/\/fg-image\.fashiongo\.net\//,
        );
      }
    }
  });

  it("records when the data was pulled", () => {
    expect(new Date(seedCatalog().syncedAt).getTime()).not.toBeNaN();
  });
});
