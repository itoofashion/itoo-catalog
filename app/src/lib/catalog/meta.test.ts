import { describe, expect, it } from "vitest";
import { catalogMeta } from "./meta";
import { EMPTY_SELECTION } from "./share";

describe("catalogMeta", () => {
  it("names the categories a client asked for", () => {
    const meta = catalogMeta({ categories: ["Dresses"], skus: [] }, 12);
    expect(meta.title).toBe("itoo — Dresses");
    expect(meta.description).toBe("12 styles in Dresses, with current prices and photos.");
  });

  it("reads as a sentence with several categories", () => {
    const meta = catalogMeta({ categories: ["Dresses", "Tops", "Pants"], skus: [] }, 40);
    expect(meta.title).toBe("itoo — Dresses, Tops and Pants");
  });

  it("mentions styles picked on top of a category", () => {
    const meta = catalogMeta({ categories: ["Tops"], skus: ["Y-542", "21034"] }, 9);
    expect(meta.description).toContain("and 2 more styles");
  });

  it("describes a hand-picked selection", () => {
    const meta = catalogMeta({ categories: [], skus: ["Y-542", "21034"] }, 2);
    expect(meta.title).toBe("itoo — 2 styles for you");
  });

  it("describes the whole catalog", () => {
    const meta = catalogMeta(EMPTY_SELECTION, 775);
    expect(meta.title).toBe("itoo — Wholesale Catalog");
    expect(meta.description).toBe("775 styles, with current prices and photos.");
  });

  it("keeps the grammar right for a single style", () => {
    const meta = catalogMeta({ categories: [], skus: ["Y-542"] }, 1);
    expect(meta.title).toBe("itoo — 1 style for you");
    expect(meta.description).not.toContain("styles");
  });
});
