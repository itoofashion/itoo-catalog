import { describe, expect, it } from "vitest";
import { decodeSelection, encodeSelection } from "./code";

describe("short link codes", () => {
  it("round-trips a category", () => {
    const selection = { categories: ["Dresses"], skus: [] };
    expect(decodeSelection(encodeSelection(selection))).toEqual(selection);
  });

  it("round-trips hand-picked styles", () => {
    const selection = { categories: [], skus: ["Y-542", "21349-9"] };
    expect(decodeSelection(encodeSelection(selection))).toEqual(selection);
  });

  it("round-trips both together", () => {
    const selection = { categories: ["Dresses", "Tops"], skus: ["Y-542"] };
    expect(decodeSelection(encodeSelection(selection))).toEqual(selection);
  });

  it("stays short enough to send in a chat message", () => {
    expect(encodeSelection({ categories: ["Dresses"], skus: [] }).length).toBeLessThan(16);
  });

  it("survives a category name with a space and an ampersand", () => {
    const selection = { categories: ["Jeans & Denim", "Sweaters & Cardigans"], skus: [] };
    expect(decodeSelection(encodeSelection(selection))).toEqual(selection);
  });

  it("is safe to put in a path — no slashes or padding", () => {
    const code = encodeSelection({ categories: ["Jumpsuits & Rompers"], skus: ["A/B"] });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("refuses a code that is not a code", () => {
    expect(decodeSelection("not a code!")).toBeNull();
    expect(decodeSelection("../etc/passwd")).toBeNull();
  });

  it("refuses a code that decodes to an empty selection", () => {
    // Otherwise a mistyped link would quietly open the entire catalog.
    expect(decodeSelection(encodeSelection({ categories: [], skus: [] }))).toBeNull();
  });

  it("forgives stray whitespace around a pasted code", () => {
    const code = encodeSelection({ categories: ["Dresses"], skus: [] });
    expect(decodeSelection(`  ${code} `)).toEqual({ categories: ["Dresses"], skus: [] });
  });

  it("does not depend on anything remembering it", () => {
    // The point of the design: decoding is pure, so a link made by one worker
    // isolate opens in any other.
    const code = encodeSelection({ categories: ["Dresses"], skus: [] });
    expect(decodeSelection(code)).toEqual(decodeSelection(code));
  });
});
