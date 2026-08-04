import { describe, expect, it } from "vitest";
import { formatColorName, swatchFor } from "./color";
import { seedProducts } from "./seed";

describe("formatColorName", () => {
  it("tidies the casing vendors type by hand", () => {
    expect(formatColorName("PINK")).toBe("Pink");
    expect(formatColorName("celeste")).toBe("Celeste");
    expect(formatColorName("BEIGE W SILVER")).toBe("Beige W Silver");
  });

  it("trims stray whitespace", () => {
    expect(formatColorName("  Beige  ")).toBe("Beige");
  });
});

describe("swatchFor", () => {
  it("matches a plain color name", () => {
    expect(swatchFor("Black")).toBe("#23211f");
    expect(swatchFor("celeste")).toBe("#a9c7d8");
  });

  it("matches on the shade word inside a compound name", () => {
    expect(swatchFor("BLUE JEANS")).toBe(swatchFor("Blue"));
    expect(swatchFor("BEIGE W SILVER")).toBe(swatchFor("Beige"));
  });

  it("falls back to a neutral chip for names it does not know", () => {
    expect(swatchFor("Zebra Print")).toBe("#c9c2b6");
  });

  it("returns a valid hex color for every color in the real catalog", () => {
    for (const product of seedProducts()) {
      for (const color of product.colors) {
        expect(swatchFor(color), `${product.sku} / ${color}`).toMatch(
          /^#[0-9a-f]{6}$/,
        );
      }
    }
  });
});
