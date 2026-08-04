import { describe, expect, it } from "vitest";
import {
  categoryNameMap,
  dedupeBySku,
  largeImageUrl,
  mapProduct,
  normalizeTimestamp,
  UNCATEGORIZED,
} from "./map";
import { imagePath } from "@/lib/images/source";
import type { FashionGoDetail, FashionGoListRecord } from "./types";

/** Shapes below mirror real FashionGo responses captured from the itoo account. */
const categories = categoryNameMap([
  { catID: 8, catName: "Tops (299) " },
  { catID: 13, catName: "Dresses (72) " },
  { catID: 1, catName: "Clothing" },
]);

const record: FashionGoListRecord = {
  productId: 26144615,
  productName: "Y-542",
  itemName: "Romantic Lace Top",
  sellingPrice: 20.75,
  imageUrl:
    "https://fg-image.fashiongo.net/Vendors/6qj6odi0wz/ProductImage/list/9EDE/26144615_a.jpg",
  _createdOn: "2026-07-28T15:02:43.153",
  _activatedOn: "2026-08-03T13:53:48.870",
  sizeId: 18988,
  packId: 19842,
  active: true,
};

/**
 * `size` and `pack` are the vendor's whole tables, exactly as FashionGo repeats
 * them in every detail response. Junk names like the third size run's are real:
 * the vendor can type anything into them, which is why the mapping reads the
 * descriptions instead.
 */
const detail: FashionGoDetail = {
  item: {
    productId: 26144615,
    categoryId: 22,
    parentCategoryId: 8,
    parentParentCategoryId: 1,
    sizeId: 18988,
    packId: 19842,
    minTQStyle: 6,
  },
  size: [
    { sizeId: 18988, sizeDescription2: "S;M;L", sizeQtyCount: 3 },
    { sizeId: 19803, sizeDescription2: "O~S", sizeQtyCount: 1 },
    { sizeId: 18989, sizeDescription2: "XS;S;M;L", sizeQtyCount: 4 },
  ],
  pack: [
    { packId: 19842, packDescription: "2-2-2", packQtyCount: 3 },
    { packId: 20485, packDescription: "6", packQtyCount: 1 },
    { packId: 55781, packDescription: "2-2-2-2", packQtyCount: 4 },
  ],
  image: [
    {
      imageUrl:
        "https://fg-image.fashiongo.net/Vendors/6qj6odi0wz/ProductImage/large/9EDE/26144615_b.jpg",
      color: "Black",
      listOrder: 2,
      active: true,
    },
    {
      imageUrl:
        "https://fg-image.fashiongo.net/Vendors/6qj6odi0wz/ProductImage/large/9EDE/26144615_a.jpg",
      color: "Beige",
      listOrder: 1,
      active: true,
    },
  ],
};

describe("categoryNameMap", () => {
  it("strips the product count FashionGo appends", () => {
    expect(categories.get(8)).toBe("Tops");
    expect(categories.get(13)).toBe("Dresses");
  });

  it("keeps names that have no count", () => {
    expect(categories.get(1)).toBe("Clothing");
  });
});

describe("normalizeTimestamp", () => {
  it("reads timezone-less FashionGo timestamps as UTC", () => {
    expect(normalizeTimestamp("2026-07-28T15:02:43.153")).toBe(
      "2026-07-28T15:02:43.153Z",
    );
  });

  it("leaves timestamps that already carry a timezone", () => {
    expect(normalizeTimestamp("2026-07-28T15:02:43.000Z")).toBe(
      "2026-07-28T15:02:43.000Z",
    );
  });

  it("passes through junk rather than throwing", () => {
    expect(normalizeTimestamp("nonsense")).toBe("nonsense");
  });
});

describe("largeImageUrl", () => {
  it("upgrades list thumbnails to the large variant", () => {
    expect(largeImageUrl(record.imageUrl!)).toContain("/ProductImage/large/");
  });

  it("leaves an already-large URL alone", () => {
    const large = detail.image![0].imageUrl;
    expect(largeImageUrl(large)).toBe(large);
  });
});

describe("mapProduct", () => {
  it("maps FashionGo's field names onto the catalog model", () => {
    const product = mapProduct(record, detail, categories);
    expect(product).toMatchObject({
      sku: "Y-542",
      name: "Romantic Lace Top",
      price: 19.75,
      category: "Tops",
      sourceId: 26144615,
      createdAt: "2026-08-03T13:53:48.870Z",
    });
  });

  it("dates a style by the day it went on sale, not the day it was uploaded", () => {
    // FashionGo's own admin lists _activatedOn and badges new items from it;
    // _createdOn is the upload date and can be weeks earlier for a draft.
    const product = mapProduct(record, detail, categories);
    expect(product.createdAt).toBe("2026-08-03T13:53:48.870Z");
  });

  it("falls back to the upload date for a style that was never activated", () => {
    const neverActivated = { ...record, _activatedOn: "" };
    expect(mapProduct(neverActivated, detail, categories).createdAt).toBe(
      "2026-07-28T15:02:43.153Z",
    );
  });

  it("orders photos the way the vendor arranged them", () => {
    const product = mapProduct(record, detail, categories);
    expect(product.images.map((i) => i.color)).toEqual(["Beige", "Black"]);
  });

  it("derives colors from the photos, without duplicates", () => {
    const twoBeige = {
      ...detail,
      image: [...detail.image!, { ...detail.image![1], listOrder: 3 }],
    };
    expect(mapProduct(record, twoBeige, categories).colors).toEqual([
      "Beige",
      "Black",
    ]);
  });

  it("skips photos the vendor deactivated", () => {
    const withHidden = {
      ...detail,
      image: [...detail.image!, { ...detail.image![0], color: "Rust", active: false }],
    };
    expect(mapProduct(record, withHidden, categories).colors).not.toContain("Rust");
  });

  it("falls back to the list thumbnail when detail has no photos", () => {
    const product = mapProduct(record, { ...detail, image: [] }, categories);
    expect(product.images).toHaveLength(1);
    expect(product.images[0].sourceUrl).toContain("/ProductImage/large/");
  });

  it("gives every photo an address of ours and remembers where it came from", () => {
    const [photo] = mapProduct(record, detail, categories).images;
    expect(photo.url).toBe(imagePath(photo.sourceUrl));
    expect(photo.url).not.toContain("26144615");
    expect(photo.sourceUrl).toBe(detail.image![1].imageUrl);
  });

  it("drops photos hosted anywhere but FashionGo instead of storing them", () => {
    // mapProduct is what fills the store, so an address from elsewhere must not
    // survive it — the image route would refuse to load it anyway.
    const foreign = {
      ...detail,
      image: [{ ...detail.image![0], imageUrl: "https://evil.example/x.jpg" }],
    };
    const product = mapProduct({ ...record, imageUrl: null }, foreign, categories);
    expect(product.images).toEqual([]);
  });

  it("falls back to the style number when the item has no name", () => {
    const product = mapProduct({ ...record, itemName: null }, detail, categories);
    expect(product.name).toBe("Y-542");
  });

  it("falls back to the leaf category when the parent is unknown", () => {
    const unknownParent = {
      ...detail,
      item: { ...detail.item, parentCategoryId: 999, categoryId: 13 },
    };
    expect(mapProduct(record, unknownParent, categories).category).toBe("Dresses");
  });

  it("marks a product uncategorized rather than inventing a category", () => {
    const noCategory = {
      ...detail,
      item: {
        ...detail.item,
        categoryId: null,
        parentCategoryId: null,
        parentParentCategoryId: null,
      },
    };
    expect(mapProduct(record, noCategory, categories).category).toBe(UNCATEGORIZED);
  });

  it("works with no detail at all, using just the list record", () => {
    const product = mapProduct(record, null, categories);
    expect(product.sku).toBe("Y-542");
    expect(product.colors).toEqual([]);
    expect(product.images).toHaveLength(1);
  });

  it("uses the unit price when selling price is missing", () => {
    const product = mapProduct(
      { ...record, sellingPrice: null, _unitPrice: 30 },
      detail,
      categories,
    );
    expect(product.price).toBe(29);
  });
});

describe("dedupeBySku", () => {
  const relisted: FashionGoListRecord = {
    ...record,
    productId: 19177532,
    itemName: "Lace Top, old listing",
    sellingPrice: 25.75,
    _activatedOn: "2023-04-21T09:00:00.000",
  };

  it("keeps the listing that went on sale last", () => {
    const products = [relisted, record].map((r) => mapProduct(r, detail, categories));
    const deduped = dedupeBySku(products);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].name).toBe("Romantic Lace Top");
    expect(deduped[0].price).toBe(19.75);
  });

  it("wins regardless of which listing came first in the payload", () => {
    const products = [record, relisted].map((r) => mapProduct(r, detail, categories));
    expect(dedupeBySku(products)[0].name).toBe("Romantic Lace Top");
  });

  it("keeps the vendor's ordering for everything else", () => {
    const other = { ...record, productName: "Y-100", productId: 1 };
    const products = [other, relisted, record].map((r) =>
      mapProduct(r, detail, categories),
    );
    expect(dedupeBySku(products).map((p) => p.sku)).toEqual(["Y-100", "Y-542"]);
  });

  it("leaves a catalog with no repeats alone", () => {
    const products = [record, { ...record, productName: "Y-100" }].map((r) =>
      mapProduct(r, detail, categories),
    );
    expect(dedupeBySku(products)).toHaveLength(2);
  });
});

describe("mapProduct, sizes and packs", () => {
  it("reads the size run and the pack split out of the vendor's tables", () => {
    const product = mapProduct(record, detail, categories);
    expect(product.sizes).toEqual(["S", "M", "L"]);
    expect(product.packBreakdown).toEqual([2, 2, 2]);
    expect(product.minimumUnits).toBe(6);
  });

  it("spells out FashionGo's one-size shorthand", () => {
    const oneSize = {
      ...detail,
      item: { ...detail.item, sizeId: 19803, packId: 20485, minTQStyle: 6 },
    };
    const product = mapProduct(record, oneSize, categories);
    expect(product.sizes).toEqual(["One Size"]);
    expect(product.packBreakdown).toEqual([6]);
    expect(product.minimumUnits).toBe(6);
  });

  it("keeps the sizes but no split for a style sold loose", () => {
    // packId 0 is how the detail says "no pack"; the list says null.
    const loose = { ...detail, item: { ...detail.item, packId: 0, minTQStyle: 6 } };
    const product = mapProduct({ ...record, packId: null }, loose, categories);
    expect(product.sizes).toEqual(["S", "M", "L"]);
    expect(product.packBreakdown).toBeNull();
    expect(product.minimumUnits).toBe(6);
  });

  it("trusts the pack over a stale minimum the vendor left behind", () => {
    // Two real styles carry a four-size pack and a minimum of six. The pack is
    // what the buyer actually receives, so it wins.
    const stale = {
      ...detail,
      item: { ...detail.item, sizeId: 18989, packId: 55781, minTQStyle: 6 },
    };
    expect(mapProduct(record, stale, categories).minimumUnits).toBe(8);
  });

  it("drops a split that does not line up with the run", () => {
    const wrongPack = {
      ...detail,
      item: { ...detail.item, sizeId: 18988, packId: 55781, minTQStyle: 6 },
    };
    const product = mapProduct(record, wrongPack, categories);
    expect(product.sizes).toEqual(["S", "M", "L"]);
    expect(product.packBreakdown).toBeNull();
    expect(product.minimumUnits).toBe(6);
  });

  it("says nothing rather than guessing when the vendor stated no minimum", () => {
    const noMinimum = {
      ...detail,
      item: { ...detail.item, packId: 0, minTQStyle: null },
    };
    const product = mapProduct({ ...record, packId: null }, noMinimum, categories);
    expect(product.minimumUnits).toBeNull();
  });

  it("leaves the sizes empty when the tables are missing or unusable", () => {
    expect(mapProduct(record, null, categories).sizes).toEqual([]);
    const junk = { ...detail, size: null, pack: null };
    const product = mapProduct(record, junk, categories);
    expect(product.sizes).toEqual([]);
    expect(product.packBreakdown).toBeNull();
    expect(product.minimumUnits).toBe(6);
  });

  it("falls back to the list record's ids when the detail carries none", () => {
    const withoutIds = {
      ...detail,
      item: { ...detail.item, sizeId: null, packId: null },
    };
    const product = mapProduct(record, withoutIds, categories);
    expect(product.sizes).toEqual(["S", "M", "L"]);
    expect(product.packBreakdown).toEqual([2, 2, 2]);
  });
});
