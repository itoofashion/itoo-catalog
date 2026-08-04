import { describe, expect, it } from "vitest";
import { packSummary } from "./pack";

describe("packSummary", () => {
  it("states the sizes, the split and the pack size", () => {
    expect(
      packSummary({ sizes: ["S", "M", "L"], packBreakdown: [2, 2, 2], minimumUnits: 6 }),
    ).toEqual({ sizes: "S · M · L", split: "2 · 2 · 2", minimum: "6 pieces per pack" });
  });

  it("handles an uneven split", () => {
    const summary = packSummary({
      sizes: ["S", "M", "L", "XL"],
      packBreakdown: [1, 2, 2, 1],
      minimumUnits: 6,
    });
    expect(summary?.split).toBe("1 · 2 · 2 · 1");
  });

  it("calls it a minimum when the vendor fixed no split", () => {
    const summary = packSummary({
      sizes: ["S", "M", "L"],
      packBreakdown: null,
      minimumUnits: 6,
    });
    expect(summary).toEqual({ sizes: "S · M · L", split: null, minimum: "6 pieces minimum" });
  });

  it("drops a split that does not line up with the sizes", () => {
    // Mismatched data would otherwise print "2 · 2" under three sizes and read
    // as a fact about an order someone is about to place.
    const summary = packSummary({
      sizes: ["S", "M", "L"],
      packBreakdown: [2, 2],
      minimumUnits: 6,
    });
    expect(summary?.split).toBeNull();
  });

  it("says nothing at all when the vendor gave nothing", () => {
    expect(packSummary({ sizes: [], packBreakdown: null, minimumUnits: null })).toBeNull();
  });

  it("still speaks up when only a minimum is known", () => {
    const summary = packSummary({ sizes: [], packBreakdown: null, minimumUnits: 12 });
    expect(summary).toEqual({ sizes: "", split: null, minimum: "12 pieces minimum" });
  });

  it("keeps the grammar right for a single piece", () => {
    const summary = packSummary({ sizes: ["One size"], packBreakdown: null, minimumUnits: 1 });
    expect(summary?.minimum).toBe("1 piece minimum");
  });
});
