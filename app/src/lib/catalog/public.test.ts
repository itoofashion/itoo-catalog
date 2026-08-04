import { describe, expect, it } from "vitest";
import { toPublicCatalog, toPublicProduct, type PublicProduct } from "./public";
import { seedCatalog, seedProducts } from "./seed";
import type { Product } from "./types";

const now = new Date("2026-08-04T12:00:00.000Z");

const stored: Product = {
  sku: "Y-542",
  name: "Romantic Lace Top",
  price: 19.75,
  category: "Tops",
  colors: ["Beige"],
  images: [
    { url: "https://fg-image.fashiongo.net/Vendors/x/ProductImage/large/a.jpg", color: "Beige" },
  ],
  createdAt: "2026-07-28T15:02:43.153Z",
  sourceId: 26144615,
};

/**
 * The catalog is served from a public address, so everything handed to a page is
 * public. These tests are the boundary: they fail if a field that belongs only
 * in the store starts being published.
 */
const PUBLISHED_FIELDS: Array<keyof PublicProduct> = [
  "sku",
  "name",
  "price",
  "category",
  "colors",
  "images",
  "isNew",
];

describe("the published product", () => {
  it("carries exactly the fields the interface needs", () => {
    expect(Object.keys(toPublicProduct(stored, now)).sort()).toEqual(
      [...PUBLISHED_FIELDS].sort(),
    );
  });

  it("keeps FashionGo's internal product id out of the browser", () => {
    const published = toPublicProduct(stored, now) as Record<string, unknown>;
    expect(published.sourceId).toBeUndefined();
    expect(JSON.stringify(published)).not.toContain("26144615");
  });

  it("publishes the new-arrival badge instead of the creation date", () => {
    const published = toPublicProduct(stored, now) as Record<string, unknown>;
    expect(published.createdAt).toBeUndefined();
    expect(published.isNew).toBe(true);
  });

  it("stops flagging a style once it is no longer new", () => {
    const old = { ...stored, createdAt: "2025-01-01T00:00:00.000Z" };
    expect(toPublicProduct(old, now).isNew).toBe(false);
  });

  it("does not carry photos' internal identifiers, only their address", () => {
    const [image] = toPublicProduct(stored, now).images;
    expect(Object.keys(image).sort()).toEqual(["color", "url"]);
  });

  it("publishes the catalog price and never the FashionGo price it came from", () => {
    // The source price is the vendor's margin and is not in the stored product
    // either — this asserts the published price is the discounted one.
    expect(toPublicProduct(stored, now).price).toBe(19.75);
  });
});

describe("the published catalog, built from the real export", () => {
  const published = toPublicCatalog(seedCatalog(), now);
  const serialized = JSON.stringify(published);

  it("publishes every product", () => {
    expect(published.products).toHaveLength(seedProducts().length);
  });

  it("leaks no internal field names", () => {
    for (const field of ["sourceId", "createdAt", "productId", "sellingPrice", "_createdOn"]) {
      expect(serialized, `${field} is published`).not.toContain(field);
    }
  });

  it("leaks no FashionGo product ids in the data", () => {
    // Photo addresses are excluded on purpose: FashionGo names its image files
    // after the product id, and the address is what makes the photo load. The
    // id stops being visible at all in Milestone 2, when photos move to our own
    // storage. Everything that is ours to control is checked here.
    const withoutPhotoUrls = JSON.stringify(
      published.products.map(({ images, ...rest }) => ({
        ...rest,
        images: images.map(({ color }) => ({ color })),
      })),
    );

    for (const product of seedProducts()) {
      expect(withoutPhotoUrls, `id of ${product.sku} is published`).not.toContain(
        String(product.sourceId),
      );
    }
  });

  it("still gives the interface what it needs to render", () => {
    for (const product of published.products) {
      expect(product.sku).toBeTruthy();
      expect(product.name).toBeTruthy();
      expect(product.price).toBeGreaterThan(0);
      expect(product.images.length).toBeGreaterThan(0);
    }
  });
});
