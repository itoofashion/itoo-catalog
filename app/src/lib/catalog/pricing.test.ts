import { describe, expect, it } from "vitest";
import { catalogPrice, formatPrice } from "./pricing";

describe("catalogPrice", () => {
  it("takes a dollar off the FashionGo price", () => {
    expect(catalogPrice(20.75)).toBe(19.75);
    expect(catalogPrice(42)).toBe(41);
  });

  it("rounds to cents instead of leaking float error", () => {
    // 20.3 - 1 is 19.299999999999997 in binary floating point.
    expect(catalogPrice(20.3)).toBe(19.3);
  });

  it("never goes negative on cheap items", () => {
    expect(catalogPrice(0.5)).toBe(0);
    expect(catalogPrice(0)).toBe(0);
  });

  it("rejects prices that are not numbers", () => {
    expect(() => catalogPrice(Number.NaN)).toThrow(/Invalid FashionGo price/);
  });
});

describe("formatPrice", () => {
  it("always shows two decimals", () => {
    expect(formatPrice(19.75)).toBe("$19.75");
    expect(formatPrice(41)).toBe("$41.00");
    expect(formatPrice(19.3)).toBe("$19.30");
  });
});
