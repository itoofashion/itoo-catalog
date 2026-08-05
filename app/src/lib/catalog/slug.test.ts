import { describe, expect, it } from "vitest";
import { seedProducts } from "./seed";
import {
  productAddress,
  productSlugs,
  readProductAddress,
  resolveCategories,
  resolveSlug,
  slugifyCategories,
  toSlug,
} from "./slug";
import { NO_FILTERS } from "./share";

const CATEGORIES = ["All", "Dresses", "Jumpsuits & Rompers", "Sweaters & Cardigans"];

describe("toSlug", () => {
  it("keeps a plain name plain", () => {
    expect(toSlug("Dresses")).toBe("dresses");
  });

  it("turns the punctuation a vendor typed into hyphens", () => {
    expect(toSlug("Jumpsuits & Rompers")).toBe("jumpsuits-rompers");
    expect(toSlug("Sweaters & Cardigans")).toBe("sweaters-cardigans");
  });

  it("never leaves a hyphen hanging off either end", () => {
    expect(toSlug(" & Tops & ")).toBe("tops");
    expect(toSlug("BEIGE W SILVER")).toBe("beige-w-silver");
  });

  it("collapses a run of separators into one hyphen", () => {
    expect(toSlug("1191  NEW")).toBe("1191-new");
  });
});

describe("resolveSlug", () => {
  it("finds the name a slug was made from", () => {
    expect(resolveSlug("jumpsuits-rompers", CATEGORIES)).toBe("Jumpsuits & Rompers");
  });

  it("still opens a link that was sent before slugs existed", () => {
    expect(resolveSlug("Jumpsuits & Rompers", CATEGORIES)).toBe("Jumpsuits & Rompers");
  });

  it("answers with nothing for a name the catalog does not have", () => {
    expect(resolveSlug("hats", CATEGORIES)).toBeNull();
    expect(resolveSlug("", CATEGORIES)).toBeNull();
    expect(resolveSlug(null, CATEGORIES)).toBeNull();
  });

  it("matches a color the same way", () => {
    expect(resolveSlug("beige-w-silver", ["Black", "BEIGE W SILVER"])).toBe("BEIGE W SILVER");
  });
});

describe("the address of one style", () => {
  it("carries the chosen color as a word rather than a code", () => {
    expect(productAddress("y-542", "BEIGE W SILVER")).toBe("/p/y-542?c=beige-w-silver");
  });

  it("says only the style when no color was chosen", () => {
    expect(productAddress("y-542", null)).toBe("/p/y-542");
  });

  it("is read back into the style and the color", () => {
    expect(readProductAddress("/p/y-542", "?c=beige")).toEqual({
      slug: "y-542",
      color: "beige",
    });
  });

  it("reads a catalog address as no style at all", () => {
    expect(readProductAddress("/", "?show=dresses")).toBeNull();
    expect(readProductAddress("/s/abc", "")).toBeNull();
  });
});

describe("categories in the catalog address", () => {
  const address = {
    selection: { categories: ["Jumpsuits & Rompers"], skus: ["Y-542"] },
    filters: { ...NO_FILTERS, category: "Sweaters & Cardigans" },
  };

  it("goes into the address as slugs", () => {
    const slugged = slugifyCategories(address);
    expect(slugged.selection.categories).toEqual(["jumpsuits-rompers"]);
    expect(slugged.filters.category).toBe("sweaters-cardigans");
  });

  it("leaves the style numbers alone", () => {
    expect(slugifyCategories(address).selection.skus).toEqual(["Y-542"]);
  });

  it("comes back out as the names the catalog holds", () => {
    const resolved = resolveCategories(slugifyCategories(address), CATEGORIES);
    expect(resolved).toEqual(address);
  });

  it("keeps a category the catalog does not know, rather than widening the link", () => {
    const resolved = resolveCategories(
      { selection: { categories: ["hats"], skus: [] }, filters: NO_FILTERS },
      CATEGORIES,
    );
    expect(resolved.selection.categories).toEqual(["hats"]);
  });
});

/**
 * The catalog as it ships, because two of these collisions exist nowhere else:
 * "WP-2142" against "WP 2142", and "1191 NEW" against "1191  NEW".
 */
describe("style slugs over the shipped catalog", () => {
  const products = seedProducts();
  const slugs = productSlugs(products);

  it("gives every style an address of its own", () => {
    const seen = new Set(products.map((product) => slugs.slugOf(product.sku)));
    expect(products).toHaveLength(737);
    expect(seen.size).toBe(products.length);
  });

  it("leads every address back to the style it came from", () => {
    for (const product of products) {
      expect(slugs.skuOf(slugs.slugOf(product.sku))).toBe(product.sku);
    }
  });

  it("settles the two collisions by sorting, not by the order of the file", () => {
    // Sorted, "WP 2142" comes before "WP-2142" (a space sorts before a hyphen),
    // so it takes the bare slug and the other one takes the suffix.
    expect(slugs.slugOf("WP 2142")).toBe("wp-2142");
    expect(slugs.slugOf("WP-2142")).toBe("wp-2142-2");
    expect(slugs.slugOf("1191  NEW")).toBe("1191-new");
    expect(slugs.slugOf("1191 NEW")).toBe("1191-new-2");
  });

  it("hands out the same addresses whatever order the catalog arrives in", () => {
    const shuffled = [...products].reverse();
    const again = productSlugs(shuffled);
    for (const product of products) {
      expect(again.slugOf(product.sku)).toBe(slugs.slugOf(product.sku));
    }
  });

  it("answers with nothing for an address no style has", () => {
    expect(slugs.skuOf("no-such-style")).toBeNull();
  });

  it("takes a style number typed in as it is printed", () => {
    expect(slugs.skuOf("Y-542")).toBe("Y-542");
  });
});
