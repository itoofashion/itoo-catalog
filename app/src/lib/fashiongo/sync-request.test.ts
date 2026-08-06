import { describe, expect, it } from "vitest";
import fixture from "./api-items.fixture.json";
import { parseSyncRequest } from "./sync-request";

const categories = new Map([[8, "Tops"]]);

/** The item the API answers with, cut to what the shop reads. See api-map.test.ts. */
const item = {
  itemId: 26191251,
  styleCode: "ITT 8268",
  itemName: "White Lace Top",
  sellingPrice: 19.75,
  minTQStyle: 6,
  sizeInfo: { sizeList: ["S", "M", "L"] },
  packInfo: null,
  colorList: [{ colorId: 225809, colorName: "Beige" }],
  images: [
    {
      imageUrl:
        "https://fg-image.fashiongo.net/Vendors/x/ProductImage/original/26191251_a.jpg",
      listOrder: 1,
      colorId: 225809,
    },
  ],
  categoryId: 22,
  parentCategoryId: 8,
  parentParentCategoryId: 1,
  createdDate: "2026-08-05T13:16:03.703",
  activatedOn: "2026-08-05T13:16:31.963",
  active: true,
};

function parse(items: unknown) {
  return parseSyncRequest({ items }, categories);
}

describe("parseSyncRequest", () => {
  it("maps FashionGo's items into catalog products", () => {
    const result = parse([item]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.products[0]).toMatchObject({
      sku: "ITT 8268",
      name: "White Lace Top",
      price: 18.75,
      category: "Tops",
      colors: ["Beige"],
      sizes: ["S", "M", "L"],
      minimumUnits: 6,
    });
  });

  it("accepts a live answer from the API whole", () => {
    // The fixture is what pubapi.fashiongo.net actually replies with, so it is
    // the closest thing here to the push the importer sends.
    const result = parseSyncRequest({ items: fixture }, categories);
    expect(result.ok).toBe(true);
    expect(result.ok && result.products.map((product) => product.sku)).toEqual([
      "8592-1786",
      "ITT 8268",
      "ITT8857",
      "R1195",
    ]);
  });

  it("leaves out the styles the vendor has taken down", () => {
    const gone = { ...item, itemId: 1, styleCode: "GONE-1", active: false };
    const result = parse([item, gone]);
    expect(result.ok && result.products.map((product) => product.sku)).toEqual(["ITT 8268"]);
  });

  it("does not judge a style that is no longer for sale", () => {
    // An item taken down years ago may be missing anything at all. It is not
    // going into the catalog, so it is no reason to refuse the whole push.
    const rubbish = { active: false };
    expect(parse([item, rubbish]).ok).toBe(true);
  });

  it("refuses to wipe the catalog with an empty push", () => {
    expect(parse([])).toEqual({
      ok: false,
      error: "Refusing to replace the catalog with nothing",
    });
  });

  it("refuses a push in which nothing is for sale", () => {
    expect(parse([{ ...item, active: false }]).ok).toBe(false);
  });

  it("rejects payloads that are not shaped like a sync", () => {
    expect(parseSyncRequest("nope").ok).toBe(false);
    expect(parseSyncRequest({ products: [item] }).ok).toBe(false);
    expect(parseSyncRequest({ items: item }).ok).toBe(false);
  });

  it("names the style that failed so the error is actionable", () => {
    const broken = { ...item, sellingPrice: "free" };
    expect(parse([item, broken])).toEqual({
      ok: false,
      error: "items[1] (ITT 8268) has an invalid price",
    });
  });

  it("rejects a style with no style number", () => {
    expect(parse([{ ...item, styleCode: " " }]).ok).toBe(false);
  });

  it("rejects a style with no date at all", () => {
    const undated = { ...item, activatedOn: null, createdDate: null };
    expect(parse([undated])).toEqual({
      ok: false,
      error: "items[0] (ITT 8268) has no date",
    });
  });

  it("collapses a style the vendor listed twice, keeping the newer listing", () => {
    // Re-listing a style is ordinary vendor behaviour, not a broken push: the
    // catalog is keyed by style number and FashionGo is not.
    const older = {
      ...item,
      itemId: 19177532,
      itemName: "Lace Top, old listing",
      activatedOn: "2023-04-21T09:00:00.000",
    };
    const result = parse([older, item]);
    expect(result.ok && result.products).toHaveLength(1);
    expect(result.ok && result.products[0].name).toBe("White Lace Top");
  });

  it("rejects photos hosted anywhere but the FashionGo CDN", () => {
    const tampered = {
      ...item,
      images: [{ ...item.images[0], imageUrl: "https://evil.example/x.jpg" }],
    };
    expect(parse([tampered])).toEqual({
      ok: false,
      error: "items[0] (ITT 8268) has a photo from outside FashionGo",
    });
  });

  it("accepts a style with no photos at all", () => {
    const result = parse([{ ...item, images: null }]);
    expect(result.ok && result.products[0].images).toEqual([]);
  });

  it("stores our own address for every photo, never the FashionGo one", () => {
    const result = parse([item]);
    const images = result.ok ? result.products[0].images : [];
    expect(images).toHaveLength(1);
    expect(images[0].url).toMatch(/^\/i\/[0-9a-f]{32}$/);
    expect(images[0].sourceUrl).toBe(item.images[0].imageUrl);
  });

  it("still imports when no category name is known", () => {
    const result = parseSyncRequest({ items: [item] }, new Map());
    expect(result.ok && result.products[0].category).toBe("Other");
  });

  /**
   * The category table is not part of the push. FashionGo's API names a style's
   * categories by number only, so the names come from the copy shipped with the
   * seed, and the endpoint has to reach for it on its own.
   */
  it("names categories without being told them", () => {
    const result = parseSyncRequest({ items: [item] });
    expect(result.ok && result.products[0].category).toBe("Tops");
  });
});
