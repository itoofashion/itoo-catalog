import { describe, expect, it } from "vitest";
import { parseSyncRequest } from "./sync-request";
import seed from "@/data/fashiongo-seed.json";

const categories = [{ catID: 8, catName: "Tops (299) " }];

const entry = {
  record: {
    productId: 26144615,
    productName: "Y-542",
    itemName: "Romantic Lace Top",
    sellingPrice: 20.75,
    imageUrl: "https://fg-image.fashiongo.net/Vendors/x/ProductImage/list/a.jpg",
    _createdOn: "2026-07-28T15:02:43.153",
    active: true,
  },
  detail: {
    item: { productId: 26144615, categoryId: 22, parentCategoryId: 8, parentParentCategoryId: 1 },
    image: [
      {
        imageUrl: "https://fg-image.fashiongo.net/Vendors/x/ProductImage/large/a.jpg",
        color: "Beige",
        listOrder: 1,
        active: true,
      },
    ],
  },
};

function parse(products: unknown, cats: unknown = categories) {
  return parseSyncRequest({ categories: cats, products });
}

describe("parseSyncRequest", () => {
  it("maps FashionGo's payload into catalog products", () => {
    const result = parse([entry]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.products[0]).toMatchObject({
      sku: "Y-542",
      name: "Romantic Lace Top",
      price: 19.75,
      category: "Tops",
      colors: ["Beige"],
    });
  });

  it("accepts exactly what the seed export contains", () => {
    // The live catalog is what the extension pushes, so it has to survive the
    // validation whole — including the styles the vendor listed more than once,
    // which collapse instead of failing the push.
    const result = parseSyncRequest({
      categories: seed.categories,
      products: seed.products.map(({ record, detail }) => ({
        record,
        detail: { ...detail, size: seed.sizes, pack: seed.packs },
      })),
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.products.length).toBeGreaterThan(700);
    expect(result.ok && result.products.length).toBeLessThanOrEqual(seed.products.length);
    const skus = result.ok ? result.products.map((p) => p.sku) : [];
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("refuses to wipe the catalog with an empty push", () => {
    expect(parse([])).toEqual({
      ok: false,
      error: "Refusing to replace the catalog with nothing",
    });
  });

  it("rejects payloads that are not shaped like a sync", () => {
    expect(parseSyncRequest("nope").ok).toBe(false);
    expect(parseSyncRequest({ products: [entry] }).ok).toBe(false);
    expect(parseSyncRequest({ categories }).ok).toBe(false);
  });

  it("names the product that failed so the error is actionable", () => {
    const broken = { ...entry, record: { ...entry.record, sellingPrice: "free" } };
    expect(parse([entry, broken])).toEqual({
      ok: false,
      error: "products[1] (Y-542) has an invalid price",
    });
  });

  it("rejects a product with no style number", () => {
    expect(parse([{ ...entry, record: { ...entry.record, productName: " " } }]).ok).toBe(false);
  });

  it("collapses a style the vendor listed twice, keeping the newer listing", () => {
    // Re-listing a style is ordinary vendor behaviour, not a broken push: the
    // catalog is keyed by style number and FashionGo is not.
    const relisted = {
      ...entry,
      record: {
        ...entry.record,
        productId: 19177532,
        itemName: "Lace Top, old listing",
        _activatedOn: "2023-04-21T09:00:00.000",
      },
    };
    const result = parse([relisted, entry]);
    expect(result.ok && result.products).toHaveLength(1);
    expect(result.ok && result.products[0].name).toBe("Romantic Lace Top");
  });

  it("rejects photos hosted anywhere but the FashionGo CDN", () => {
    const tampered = {
      ...entry,
      detail: {
        ...entry.detail,
        image: [{ ...entry.detail.image[0], imageUrl: "https://evil.example/x.jpg" }],
      },
    };
    expect(parse([tampered]).ok).toBe(false);
  });

  it("rejects a list thumbnail from outside the FashionGo CDN", () => {
    // The thumbnail is the fallback photo when a product has no detail images,
    // so it can reach the store the same way and is held to the same rule.
    const tampered = {
      ...entry,
      record: { ...entry.record, imageUrl: "https://evil.example/x.jpg" },
    };
    expect(parse([tampered])).toEqual({
      ok: false,
      error: "products[0] (Y-542) has a photo from outside FashionGo",
    });
  });

  it("accepts a product that has no thumbnail at all", () => {
    const result = parse([{ ...entry, record: { ...entry.record, imageUrl: null } }]);
    expect(result.ok).toBe(true);
  });

  it("stores our own address for every photo, never the FashionGo one", () => {
    const result = parse([entry]);
    const images = result.ok ? result.products[0].images : [];
    expect(images).toHaveLength(1);
    expect(images[0].url).toMatch(/^\/i\/[0-9a-f]{32}$/);
    expect(images[0].sourceUrl).toBe(entry.detail.image[0].imageUrl);
  });

  it("accepts a product whose detail could not be fetched", () => {
    const result = parse([{ record: entry.record, detail: null }]);
    expect(result.ok && result.products[0].images).toHaveLength(1);
  });

  it("still imports when the category list is unusable", () => {
    const result = parse([entry], [{ nonsense: true }]);
    expect(result.ok && result.products[0].category).toBe("Other");
  });
});
