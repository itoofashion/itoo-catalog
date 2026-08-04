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
  isNew: true,
};

describe("orderText", () => {
  it("reads as a plain message a buyer can paste into a chat", () => {
    expect(orderText(product, "BEIGE W SILVER")).toBe(
      ["Romantic Lace Top", "SKU: Y-542", "Color: Beige W Silver", "Price: $19.75 / unit"].join("\n"),
    );
  });

  it("omits the color line for a single-color style", () => {
    expect(orderText(product, null)).not.toContain("Color:");
  });

  it("appends the catalog link when one is given", () => {
    expect(orderText(product, null, "https://itoo.example/x")).toContain(
      "https://itoo.example/x",
    );
  });
});
