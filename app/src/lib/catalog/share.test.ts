import { describe, expect, it } from "vitest";
import { buildShareQuery, parseShareQuery } from "./share";

describe("buildShareQuery", () => {
  it("encodes a hand-picked set of items", () => {
    expect(buildShareQuery({ skus: ["Y-542", "Y-543"], category: null })).toBe(
      "?items=Y-542%2CY-543",
    );
  });

  it("encodes a whole category", () => {
    expect(buildShareQuery({ skus: [], category: "Dresses" })).toBe(
      "?category=Dresses",
    );
  });

  it("treats All as no category filter", () => {
    expect(buildShareQuery({ skus: [], category: "All" })).toBe("");
  });

  it("returns an empty string for the full catalog", () => {
    expect(buildShareQuery({ skus: [], category: null })).toBe("");
  });
});

describe("parseShareQuery", () => {
  it("round-trips a selection", () => {
    const selection = { skus: ["Y-542", "Y-543"], category: "Dresses" };
    const query = buildShareQuery(selection);
    expect(parseShareQuery(new URLSearchParams(query))).toEqual(selection);
  });

  it("reads Next.js style search params", () => {
    expect(parseShareQuery({ items: "Y-542,Y-543" })).toEqual({
      skus: ["Y-542", "Y-543"],
      category: null,
    });
  });

  it("ignores blank and stray whitespace entries", () => {
    expect(parseShareQuery({ items: " Y-542 , ,Y-543," }).skus).toEqual([
      "Y-542",
      "Y-543",
    ]);
  });

  it("falls back to the full catalog when nothing is selected", () => {
    expect(parseShareQuery({})).toEqual({ skus: [], category: null });
  });
});
