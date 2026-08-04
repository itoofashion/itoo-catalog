import { describe, expect, it } from "vitest";
import { parseSyncPayload } from "./sync-payload";
import { seedProducts } from "./seed";

const validProduct = {
  sku: "Y-542",
  name: "Romantic Lace Top",
  price: 19.75,
  category: "Tops",
  colors: ["Beige"],
  images: [
    { url: "https://fg-image.fashiongo.net/Vendors/x/ProductImage/large/a.jpg", color: "Beige" },
  ],
  createdAt: "2026-07-28T15:02:43.153Z",
  sourceId: 26144615,
};

function parse(products: unknown) {
  return parseSyncPayload({ products });
}

describe("parseSyncPayload", () => {
  it("accepts what the extension sends", () => {
    const result = parse([validProduct]);
    expect(result).toEqual({ ok: true, products: [validProduct] });
  });

  it("accepts the real catalog round-tripped through JSON", () => {
    const products = JSON.parse(JSON.stringify(seedProducts()));
    const result = parseSyncPayload({ products });
    expect(result.ok).toBe(true);
  });

  it("refuses to wipe the catalog with an empty push", () => {
    expect(parse([])).toEqual({
      ok: false,
      error: "Refusing to replace the catalog with nothing",
    });
  });

  it("rejects a payload that is not an object", () => {
    expect(parseSyncPayload("nope").ok).toBe(false);
    expect(parseSyncPayload(null).ok).toBe(false);
  });

  it("rejects a missing products array", () => {
    expect(parseSyncPayload({}).ok).toBe(false);
  });

  it("names the product that failed, so the error is actionable", () => {
    const result = parse([validProduct, { ...validProduct, sku: "X-1", price: "free" }]);
    expect(result).toEqual({ ok: false, error: "products[1] (X-1) has an invalid price" });
  });

  it("rejects products with no style number", () => {
    expect(parse([{ ...validProduct, sku: "  " }]).ok).toBe(false);
  });

  it("rejects duplicate style numbers", () => {
    const result = parse([validProduct, validProduct]);
    expect(result).toEqual({ ok: false, error: "products[1] repeats sku Y-542" });
  });

  it("rejects negative prices", () => {
    expect(parse([{ ...validProduct, price: -1 }]).ok).toBe(false);
  });

  it("rejects images hosted anywhere but the FashionGo CDN", () => {
    const result = parse([
      { ...validProduct, images: [{ url: "https://evil.example/x.jpg", color: null }] },
    ]);
    expect(result.ok).toBe(false);
  });

  it("falls back to the style number when a name is missing", () => {
    const result = parse([{ ...validProduct, name: "" }]);
    expect(result.ok && result.products[0].name).toBe("Y-542");
  });

  it("falls back to Other when a category is missing", () => {
    const result = parse([{ ...validProduct, category: undefined }]);
    expect(result.ok && result.products[0].category).toBe("Other");
  });

  it("drops color entries that are not strings", () => {
    const result = parse([{ ...validProduct, colors: ["Beige", 42, "", null] }]);
    expect(result.ok && result.products[0].colors).toEqual(["Beige"]);
  });
});
