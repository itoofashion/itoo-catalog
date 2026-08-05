import { describe, expect, it } from "vitest";
import { catalogMeta, productMeta } from "./meta";
import type { PublicProduct } from "./public";
import { EMPTY_SELECTION } from "./share";

describe("catalogMeta", () => {
  it("names the categories a client asked for", () => {
    const meta = catalogMeta({ categories: ["Dresses"], skus: [] }, 12);
    expect(meta.title).toBe("itoo · Dresses");
    expect(meta.description).toBe("12 styles in Dresses, with current prices and photos.");
  });

  it("reads as a sentence with several categories", () => {
    const meta = catalogMeta({ categories: ["Dresses", "Tops", "Pants"], skus: [] }, 40);
    expect(meta.title).toBe("itoo · Dresses, Tops and Pants");
  });

  it("mentions styles picked on top of a category", () => {
    const meta = catalogMeta({ categories: ["Tops"], skus: ["Y-542", "21034"] }, 9);
    expect(meta.description).toContain("and 2 more styles");
  });

  it("describes a hand-picked selection", () => {
    const meta = catalogMeta({ categories: [], skus: ["Y-542", "21034"] }, 2);
    expect(meta.title).toBe("itoo · 2 styles for you");
  });

  it("describes the whole catalog", () => {
    const meta = catalogMeta(EMPTY_SELECTION, 775);
    expect(meta.title).toBe("itoo · Wholesale Catalog");
    expect(meta.description).toBe("775 styles, with current prices and photos.");
  });

  it("keeps the grammar right for a single style", () => {
    const meta = catalogMeta({ categories: [], skus: ["Y-542"] }, 1);
    expect(meta.title).toBe("itoo · 1 style for you");
    expect(meta.description).not.toContain("styles");
  });
});

describe("productMeta", () => {
  const product: PublicProduct = {
    sku: "Y-542",
    name: "Romantic Lace Top",
    price: 19.75,
    category: "Tops",
    colors: ["BEIGE W SILVER"],
    images: [],
    sizes: ["S", "M", "L"],
    packBreakdown: [2, 2, 2],
    minimumUnits: 6,
    isNew: true,
    isHidden: false,
  };

  it("unfurls as the style itself, not as the catalog it sits in", () => {
    const meta = productMeta(product, "BEIGE W SILVER");
    expect(meta.title).toBe("itoo · Romantic Lace Top");
    expect(meta.description).toBe(
      "Y-542 · $19.75 per unit · Beige W Silver, with photos and pack details.",
    );
  });

  it("carries the style number and the price whatever the color", () => {
    const meta = productMeta(product, null);
    expect(meta.description).toBe("Y-542 · $19.75 per unit, with photos and pack details.");
  });
});
