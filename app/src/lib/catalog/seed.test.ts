import { describe, expect, it } from "vitest";
import { categoriesOf } from "./filter";
import { toPublicCatalog } from "./public";
import { seedCatalog, seedProducts } from "./seed";
import { UNCATEGORIZED } from "@/lib/fashiongo/map";

/**
 * These run against the real FashionGo export in src/data. They are the guard
 * that the mapping still fits the vendor's actual data, not just handmade cases.
 */
describe("seed catalog", () => {
  const products = seedProducts();

  it("contains the vendor's whole active catalog, not a sample of it", () => {
    expect(products.length).toBeGreaterThanOrEqual(700);
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
    const published = toPublicCatalog(seedCatalog(), new Date()).products;
    expect(categoriesOf(published).length).toBeGreaterThan(2);
  });

  it("serves photos from our own domain, over addresses we minted", () => {
    for (const product of products) {
      for (const image of product.images) {
        expect(image.url, `photo of ${product.sku}`).toMatch(/^\/i\/[0-9a-f]{32}$/);
        expect(image.sourceUrl, `source of ${product.sku}`).toMatch(
          /^https:\/\/fg-image\.fashiongo\.net\//,
        );
      }
    }
  });

  it("records when the data was pulled", () => {
    expect(new Date(seedCatalog().syncedAt).getTime()).not.toBeNaN();
  });
});

/**
 * The vendor sells by the pack, so a style without a size run is a style a
 * client cannot order. These assert the size and pack tables were understood,
 * against all 775 real styles rather than the handful in map.test.ts.
 */
describe("seed catalog, sizes and packs", () => {
  const products = seedProducts();

  it("states a size run for every product", () => {
    const runless = products.filter((p) => p.sizes.length === 0);
    expect(runless.map((p) => p.sku)).toEqual([]);
  });

  it("gives every size in a pack its own count", () => {
    for (const product of products) {
      if (!product.packBreakdown) continue;
      expect(product.packBreakdown.length, `split of ${product.sku}`).toBe(
        product.sizes.length,
      );
    }
  });

  it("adds a pack up to the minimum order it publishes", () => {
    for (const product of products) {
      if (!product.packBreakdown) continue;
      const total = product.packBreakdown.reduce((sum, count) => sum + count, 0);
      expect(total, `pack of ${product.sku}`).toBe(product.minimumUnits);
    }
  });

  it("counts whole pieces, never fractions of one", () => {
    for (const product of products) {
      for (const count of product.packBreakdown ?? []) {
        expect(Number.isInteger(count) && count > 0, `split of ${product.sku}`).toBe(true);
      }
      if (product.minimumUnits !== null) {
        expect(product.minimumUnits, `minimum of ${product.sku}`).toBeGreaterThan(0);
      }
    }
  });

  it("still sells most of the catalog as prepacks, a few loose", () => {
    // Both shapes exist in the real data, so the interface has to handle both.
    const prepacked = products.filter((p) => p.packBreakdown !== null);
    expect(prepacked.length).toBeGreaterThan(products.length / 2);
    expect(prepacked.length).toBeLessThan(products.length);
  });
});

describe("seed catalog, when styles were added", () => {
  const products = seedProducts();

  it("spans years of the vendor's history", () => {
    const years = new Set(products.map((p) => p.createdAt.slice(0, 4)));
    expect(years.size).toBeGreaterThan(3);
  });

  it("marks only a small share of the catalog as new", () => {
    // The pilot's first export was ten products off the top of the list, which
    // is sorted by activation date, so every one of them looked new. Against the
    // whole catalog the badge has to mean something again.
    const published = toPublicCatalog(seedCatalog(), new Date()).products;
    const isNew = published.filter((p) => p.isNew);
    expect(isNew.length).toBeGreaterThan(0);
    expect(isNew.length).toBeLessThan(published.length / 4);
  });

  it("dates every product", () => {
    for (const product of products) {
      expect(new Date(product.createdAt).getTime(), `date of ${product.sku}`).not.toBeNaN();
    }
  });
});
