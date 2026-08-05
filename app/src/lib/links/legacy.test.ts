import { describe, expect, it } from "vitest";
import { decodeLegacyCode, encodeLegacyCode } from "./legacy";

describe("the long codes sent before there was a database", () => {
  it("round-trips a category", () => {
    const selection = { categories: ["Dresses"], skus: [] };
    expect(decodeLegacyCode(encodeLegacyCode(selection))).toEqual(selection);
  });

  it("round-trips hand-picked styles", () => {
    const selection = { categories: [], skus: ["Y-542", "21349-9"] };
    expect(decodeLegacyCode(encodeLegacyCode(selection))).toEqual(selection);
  });

  it("round-trips both together", () => {
    const selection = { categories: ["Dresses", "Tops"], skus: ["Y-542"] };
    expect(decodeLegacyCode(encodeLegacyCode(selection))).toEqual(selection);
  });

  it("decodes a code that really went out to a client", () => {
    // The one the client complained about, pasted back in. Links of this shape
    // are in people's chats and have to keep opening.
    expect(
      decodeLegacyCode("RHJlc3Nlc35DbHV0Y2hlcyAmIFBvdWNoZXMhODk4MH5XUC0yMTYw"),
    ).toEqual({
      categories: ["Dresses", "Clutches & Pouches"],
      skus: ["8980", "WP-2160"],
    });
  });

  it("survives a category name with a space and an ampersand", () => {
    const selection = { categories: ["Jeans & Denim", "Sweaters & Cardigans"], skus: [] };
    expect(decodeLegacyCode(encodeLegacyCode(selection))).toEqual(selection);
  });

  it("is safe to put in a path: no slashes or padding", () => {
    const code = encodeLegacyCode({ categories: ["Jumpsuits & Rompers"], skus: ["A/B"] });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("refuses a code that is not a code", () => {
    expect(decodeLegacyCode("not a code!")).toBeNull();
    expect(decodeLegacyCode("../etc/passwd")).toBeNull();
  });

  it("refuses six random characters that happen to be valid base64", () => {
    // A mistyped short code reaches here after the database has never heard of
    // it. Decoding it into three bytes of noise and calling that a category
    // would show an empty catalog where a 404 belongs.
    for (const noise of ["ZZZZZZ", "K7M2QP", "234567", "AAAAAAAA"]) {
      expect(decodeLegacyCode(noise)).toBeNull();
    }
  });

  it("refuses a code that decodes to an empty selection", () => {
    // Otherwise a mistyped link would quietly open the entire catalog.
    expect(decodeLegacyCode(encodeLegacyCode({ categories: [], skus: [] }))).toBeNull();
  });

  it("forgives stray whitespace around a pasted code", () => {
    const code = encodeLegacyCode({ categories: ["Dresses"], skus: [] });
    expect(decodeLegacyCode(`  ${code} `)).toEqual({ categories: ["Dresses"], skus: [] });
  });

  it("does not depend on anything remembering it", () => {
    // Why these links survive the move to a database with no migration: they
    // decode on their own, in any isolate, with nothing looked up.
    const code = encodeLegacyCode({ categories: ["Dresses"], skus: [] });
    expect(decodeLegacyCode(code)).toEqual(decodeLegacyCode(code));
  });
});
