import { describe, expect, it } from "vitest";
import { fingerprintSelection } from "./fingerprint";

describe("the fingerprint a selection is stored under", () => {
  it("does not move when the ticks were made in another order", () => {
    // Which is what makes the same selection reuse its code: the two people who
    // built it in a different order look the same to the unique index.
    expect(fingerprintSelection({ categories: ["Tops", "Dresses"], skus: ["B", "A"] })).toBe(
      fingerprintSelection({ categories: ["Dresses", "Tops"], skus: ["A", "B"] }),
    );
  });

  it("ignores a style ticked twice and stray whitespace", () => {
    expect(fingerprintSelection({ categories: [], skus: ["Y-542", "Y-542", " Y-542 "] })).toBe(
      fingerprintSelection({ categories: [], skus: ["Y-542"] }),
    );
  });

  it("tells apart a category and a style of the same name", () => {
    expect(fingerprintSelection({ categories: ["Dresses"], skus: [] })).not.toBe(
      fingerprintSelection({ categories: [], skus: ["Dresses"] }),
    );
  });

  it("does not fuse selections whose names contain punctuation", () => {
    // A comma or a tilde as separator would make these two the same selection,
    // and one client would be sent the catalog built for another.
    expect(fingerprintSelection({ categories: ["Jeans & Denim, Tops"], skus: [] })).not.toBe(
      fingerprintSelection({ categories: ["Jeans & Denim", "Tops"], skus: [] }),
    );
  });

  it("tells apart selections that differ by one style", () => {
    expect(fingerprintSelection({ categories: ["Dresses"], skus: ["A"] })).not.toBe(
      fingerprintSelection({ categories: ["Dresses"], skus: ["A", "B"] }),
    );
  });
});
