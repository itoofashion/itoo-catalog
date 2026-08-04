import { describe, expect, it } from "vitest";
import { packSummary } from "./pack";

describe("packSummary", () => {
  it("hangs each count on its own size", () => {
    expect(
      packSummary({ sizes: ["S", "M", "L"], packBreakdown: [2, 2, 2], minimumUnits: 6 }),
    ).toEqual({
      sizes: [
        { label: "S", units: 2 },
        { label: "M", units: 2 },
        { label: "L", units: 2 },
      ],
      perSize: true,
      run: "S ×2 · M ×2 · L ×2",
      minimum: "6 pcs",
    });
  });

  it("keeps an uneven split in the order the sizes came in", () => {
    const summary = packSummary({
      sizes: ["S", "M", "L", "XL"],
      packBreakdown: [1, 2, 2, 1],
      minimumUnits: 6,
    });
    expect(summary?.run).toBe("S ×1 · M ×2 · L ×2 · XL ×1");
  });

  it("prints the sizes bare when the vendor fixed no split", () => {
    const summary = packSummary({
      sizes: ["S", "M", "L"],
      packBreakdown: null,
      minimumUnits: 6,
    });
    expect(summary).toEqual({
      sizes: [
        { label: "S", units: null },
        { label: "M", units: null },
        { label: "L", units: null },
      ],
      perSize: false,
      run: "S · M · L",
      minimum: "6 pcs",
    });
  });

  it("drops a split that does not line up with the sizes", () => {
    // Mismatched data would otherwise hang "2" on a size the vendor never said
    // it belonged to, and read as a fact about an order about to be placed.
    const summary = packSummary({
      sizes: ["S", "M", "L"],
      packBreakdown: [2, 2],
      minimumUnits: 6,
    });
    expect(summary?.perSize).toBe(false);
    expect(summary?.run).toBe("S · M · L");
  });

  it("says nothing at all when the vendor gave nothing", () => {
    expect(packSummary({ sizes: [], packBreakdown: null, minimumUnits: null })).toBeNull();
  });

  it("still speaks up when only a minimum is known", () => {
    const summary = packSummary({ sizes: [], packBreakdown: null, minimumUnits: 12 });
    expect(summary).toEqual({ sizes: [], perSize: false, run: "", minimum: "12 pcs" });
  });

  it("states a minimum of one", () => {
    const summary = packSummary({ sizes: ["One size"], packBreakdown: null, minimumUnits: 1 });
    expect(summary?.minimum).toBe("1 pcs");
  });

  it("counts a one-size style that ships six deep", () => {
    // The real shape of the "6" split: one size, six pieces of it.
    const summary = packSummary({
      sizes: ["One size"],
      packBreakdown: [6],
      minimumUnits: 6,
    });
    expect(summary?.run).toBe("One size ×6");
  });
});
