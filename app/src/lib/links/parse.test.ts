import { describe, expect, it } from "vitest";
import { parseSelection } from "./parse";

describe("parseSelection", () => {
  it("accepts what the link panel posts", () => {
    expect(parseSelection({ categories: ["Tops"], skus: ["Y-542"] })).toEqual({
      categories: ["Tops"],
      skus: ["Y-542"],
    });
  });

  it("accepts a selection of categories alone", () => {
    expect(parseSelection({ categories: ["Tops"] })).toEqual({
      categories: ["Tops"],
      skus: [],
    });
  });

  it("refuses to mint a link for nothing", () => {
    expect(parseSelection({ categories: [], skus: [] })).toBeNull();
    expect(parseSelection({})).toBeNull();
  });

  it("rejects anything that is not an object", () => {
    expect(parseSelection("Tops")).toBeNull();
    expect(parseSelection(["Tops"])).toBeNull();
    expect(parseSelection(null)).toBeNull();
  });

  it("rejects a selection that is not made of lists", () => {
    expect(parseSelection({ categories: "Tops" })).toBeNull();
  });

  it("drops entries that are not names", () => {
    expect(parseSelection({ skus: ["Y-542", 42, "", null, "  "] })).toEqual({
      categories: [],
      skus: ["Y-542"],
    });
  });

  it("removes duplicates so one selection means one link", () => {
    expect(parseSelection({ categories: ["Tops", "Tops"] })?.categories).toEqual(["Tops"]);
  });

  it("refuses an implausibly large selection", () => {
    const skus = Array.from({ length: 501 }, (_, index) => `SKU-${index}`);
    expect(parseSelection({ skus })).toBeNull();
  });
});
