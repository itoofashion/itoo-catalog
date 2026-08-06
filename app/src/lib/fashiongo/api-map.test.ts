import { describe, expect, it } from "vitest";
import { seedCategoryNames } from "@/lib/catalog/seed";
import { imagePath } from "@/lib/images/source";
import items from "./api-items.fixture.json";
import { mapApiCatalog, mapApiItem, type FashionGoApiItem } from "./api-map";

/**
 * The fixture is six items copied out of a live answer from
 * `GET pubapi.fashiongo.net/v1.0/items`, cut down to the fields this mapping
 * reads and otherwise untouched: the style numbers, prices, photo addresses and
 * dates are the vendor's own, which is the point. A mapping tested against
 * invented payloads tests the invention.
 *
 * Between them the six cover what the catalog trips over:
 *
 *   8592-1786  a pack, three colors, some photos tagged with one and some not,
 *              and no stated minimum, so the pack has to supply it
 *   ITT 8268   sold loose, one color, every photo tagged with it
 *   ITT8857    listed twice; this is the later listing, one color, no photo
 *              tagged
 *   ITT8857    the earlier listing of the same style, which loses
 *   R1195      one size, sold loose, no stated minimum at all
 *   ITV8996    inactive: a style the vendor has taken down
 */
const catalog = items as FashionGoApiItem[];

const categories = new Map([
  [8, "Tops"],
  [9, "Outerwear"],
  [10, "Pants"],
]);

function itemAt(styleCode: string, itemId?: number): FashionGoApiItem {
  const found = catalog.find(
    (item) => item.styleCode === styleCode && (itemId === undefined || item.itemId === itemId),
  );
  if (!found) throw new Error(`No fixture item ${styleCode}`);
  return found;
}

function map(styleCode: string, itemId?: number) {
  return mapApiItem(itemAt(styleCode, itemId), categories);
}

describe("mapping one item from the API", () => {
  it("keys the product by the vendor style number", () => {
    expect(map("ITT 8268").sku).toBe("ITT 8268");
    expect(map("ITT 8268").sourceId).toBe(26191251);
  });

  it("takes the client's discount off FashionGo's price", () => {
    // FashionGo sells it at 36.75; the client agreed a dollar off.
    expect(map("8592-1786").price).toBe(35.75);
  });

  it("names the product, falling back to the style number", () => {
    expect(map("ITT 8268").name).toBe("White Lace Top");
    expect(mapApiItem({ ...itemAt("ITT 8268"), itemName: "  " }, categories).name).toBe(
      "ITT 8268",
    );
  });

  it("files it under the parent category, not the leaf one", () => {
    // categoryId 22 is a leaf nobody browses by; its parent, 8, is "Tops".
    expect(map("ITT 8268").category).toBe("Tops");
  });

  it("files a style under Other when no id it carries has a name", () => {
    expect(mapApiItem(itemAt("ITT 8268"), new Map()).category).toBe("Other");
  });

  it("dates it from the day it went on sale, not the day it was uploaded", () => {
    // Uploaded on the 11th, put on sale on the 12th, and FashionGo states
    // neither with a timezone even though both are UTC.
    expect(itemAt("8592-1786").createdDate).toBe("2026-02-11T14:58:03.94");
    expect(map("8592-1786").createdAt).toBe("2026-02-12T13:12:02.783Z");
  });
});

describe("how a style is bought", () => {
  it("reads the pack split against the size run", () => {
    const product = map("8592-1786");
    expect(product.sizes).toEqual(["S", "M", "L"]);
    expect(product.packBreakdown).toEqual([2, 2, 2]);
    // The vendor states no minimum on this style, so the pack is the minimum.
    expect(product.minimumUnits).toBe(6);
  });

  it("leaves a style sold loose without a pack, keeping its minimum", () => {
    const product = map("ITT 8268");
    expect(product.sizes).toEqual(["S", "M", "L"]);
    expect(product.packBreakdown).toBeNull();
    expect(product.minimumUnits).toBe(6);
  });

  it("says nothing about a minimum the vendor never stated", () => {
    const product = map("R1195");
    expect(product.packBreakdown).toBeNull();
    expect(product.minimumUnits).toBeNull();
  });

  it("spells out the one-size code", () => {
    expect(map("R1195").sizes).toEqual(["One Size"]);
  });

  it("drops a pack split that does not line up with the size run", () => {
    // Nothing here can say which two of the three sizes the pair is, and a
    // guess would be worse than the total on its own.
    const product = mapApiItem(
      { ...itemAt("8592-1786"), packInfo: { packList: [2, 2] }, minTQStyle: 4 },
      categories,
    );
    expect(product.packBreakdown).toBeNull();
    expect(product.minimumUnits).toBe(4);
  });
});

describe("photographs and the colors they show", () => {
  it("gives every photo an address of ours and keeps FashionGo's", () => {
    const [first] = map("ITT 8268").images;
    expect(first.sourceUrl).toContain("fg-image.fashiongo.net");
    expect(first.sourceUrl).toContain("/ProductImage/original/");
    expect(first.url).toBe(imagePath(first.sourceUrl));
  });

  it("puts the photos in the order the vendor arranged them", () => {
    const item = itemAt("ITT 8268");
    const shuffled = { ...item, images: [...(item.images ?? [])].reverse() };
    expect(mapApiItem(shuffled, categories).images.map((image) => image.url)).toEqual(
      map("ITT 8268").images.map((image) => image.url),
    );
  });

  it("names the color a photo is tagged with", () => {
    const product = map("8592-1786");
    // The first two photos carry color 225810, which the item calls "Blue".
    expect(product.images.slice(0, 2).map((image) => image.color)).toEqual(["Blue", "Blue"]);
    expect(product.images[2].color).toBeNull();
    // The sixth is the one photograph of 228436, "Grey".
    expect(product.images[5].color).toBe("Grey");
    // Only colors some photo shows become swatches, in the order the vendor
    // arranged the photographs: the style also lists Brown, and there is no
    // photograph of it.
    expect(product.colors).toEqual(["Blue", "Grey"]);
  });

  it("leaves a style whose photos carry no color without one", () => {
    // The commonest case by far: the vendor lists a color but tags no photo
    // with it, and a swatch that opens nothing is worse than no swatch.
    const product = map("ITT8857", 26147704);
    expect(product.images.every((image) => image.color === null)).toBe(true);
    expect(product.colors).toEqual([]);
  });

  it("refuses a photo from anywhere but FashionGo's CDN", () => {
    const item = itemAt("ITT 8268");
    const tampered = {
      ...item,
      images: [
        { imageUrl: "https://example.com/a.jpg", listOrder: 1, colorId: null },
        ...(item.images ?? []),
      ],
    };
    expect(mapApiItem(tampered, categories).images).toHaveLength(3);
  });
});

describe("mapping the whole answer", () => {
  it("leaves out styles the vendor has taken down", () => {
    const products = mapApiCatalog(catalog, categories);
    expect(products.map((product) => product.sku)).not.toContain("ITV8996");
  });

  /**
   * The catalog is keyed by style number; FashionGo is keyed by its own item id,
   * and re-listing a style means uploading it again under the same number. The
   * listing that went on sale last is the one clients can order.
   */
  it("keeps only the latest listing of a style listed twice", () => {
    const products = mapApiCatalog(catalog, categories);
    const listed = products.filter((product) => product.sku === "ITT8857");
    expect(listed).toHaveLength(1);
    expect(listed[0].sourceId).toBe(26147704);
  });

  it("keeps the order FashionGo answered in", () => {
    expect(mapApiCatalog(catalog, categories).map((product) => product.sku)).toEqual([
      "8592-1786",
      "ITT 8268",
      "ITT8857",
      "R1195",
    ]);
  });
});

/**
 * The API says which category a style is in by number and never says what the
 * numbers mean, so the names come from the table shipped with the seed. That
 * only works while the numbers the API answers with are numbers that table
 * knows, which is a promise about live data and worth a test of its own.
 */
describe("against the shipped category table", () => {
  it("files every style in the fixture under a real category", () => {
    const products = mapApiCatalog(catalog, seedCategoryNames());
    expect(products.map((product) => product.category)).toEqual([
      "Sets",
      "Tops",
      "Tops",
      "Pants",
    ]);
  });
});
