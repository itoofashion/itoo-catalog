import { describe, expect, it } from "vitest";
import { orderText } from "./order";
import type { PublicProduct } from "./public";

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

describe("orderText", () => {
  it("reads as a plain message a buyer can paste into a chat", () => {
    expect(orderText(product, "BEIGE W SILVER")).toBe(
      [
        "Romantic Lace Top",
        "SKU: Y-542",
        "Color: Beige W Silver",
        "Pack: S ×2 · M ×2 · L ×2",
        "Minimum order: 6 pieces",
        "Price: $19.75 / unit",
      ].join("\n"),
    );
  });

  it("sends the sizes bare when the vendor fixed no split", () => {
    const loose = { ...product, packBreakdown: null };
    expect(orderText(loose, null)).toContain("Sizes: S · M · L");
  });

  it("omits the color line for a single-color style", () => {
    expect(orderText(product, null)).not.toContain("Color:");
  });

  it("says nothing about sizes when the vendor gave none", () => {
    const loose = { ...product, sizes: [], packBreakdown: null, minimumUnits: null };
    const text = orderText(loose, null);
    expect(text).not.toContain("Sizes:");
    expect(text).not.toContain("Pack:");
    expect(text).not.toContain("Minimum order:");
  });

  it("ends on the link to the style, where the photos are", () => {
    const text = orderText(product, "BEIGE W SILVER", "https://itoo.example/p/y-542?c=beige-w-silver");
    expect(text.split("\n").at(-1)).toBe("https://itoo.example/p/y-542?c=beige-w-silver");
  });

  it("says the same about the details with or without the link", () => {
    const bare = orderText(product, "BEIGE W SILVER");
    const linked = orderText(product, "BEIGE W SILVER", "https://itoo.example/p/y-542");
    expect(linked.startsWith(bare)).toBe(true);
  });
});
