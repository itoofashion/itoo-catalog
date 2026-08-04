import { describe, expect, it } from "vitest";
import {
  categoryNameMap,
  largeImageUrl,
  mapProduct,
  normalizeTimestamp,
  UNCATEGORIZED,
} from "./map";
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
  active: true,
};

const detail: FashionGoDetail = {
  item: {
    productId: 26144615,
    categoryId: 22,
    parentCategoryId: 8,
    parentParentCategoryId: 1,
  },
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
      createdAt: "2026-07-28T15:02:43.153Z",
    });
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
    expect(product.images[0].url).toContain("/ProductImage/large/");
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
