import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/catalog/types";
import {
  imageKey,
  imagePath,
  imageSourceIn,
  isImageKey,
  isImageSource,
} from "./source";

const source =
  "https://fg-image.fashiongo.net/Vendors/6qj6odi0wz/ProductImage/large/9EDE/26144615_a.jpg";

/** Only the photos matter here, which is all the lookup is given. */
const product: Pick<Product, "images"> = {
  images: [{ url: imagePath(source), sourceUrl: source, color: "Beige" }],
};

describe("image keys", () => {
  it("gives the same photo the same key every time", () => {
    expect(imageKey(source)).toBe(imageKey(source));
  });

  it("gives different photos different keys", () => {
    expect(imageKey(source)).not.toBe(imageKey(source.replace("_a.jpg", "_b.jpg")));
  });

  it("says nothing about the photo it was made from", () => {
    // The whole reason photos moved off FashionGo's CDN: their filenames are
    // the product id, and the id is not the client's business.
    const key = imageKey(source);
    expect(key).not.toContain("26144615");
    expect(key).not.toContain("fashiongo");
    // Not an encoding of the address either — a hash of it, and a short one.
    expect(key.length).toBeLessThan(source.length / 2);
  });

  it("is a fixed-length hex string, so a key is easy to recognise", () => {
    expect(imageKey(source)).toMatch(/^[0-9a-f]{32}$/);
    expect(isImageKey(imageKey(source))).toBe(true);
  });

  it("rejects anything that is not a key we could have made", () => {
    for (const value of [
      "",
      "../../etc/passwd",
      "https://evil.example/x.jpg",
      imageKey(source).toUpperCase(),
      `${imageKey(source)}0`,
    ]) {
      expect(isImageKey(value), value).toBe(false);
    }
  });

  it("publishes the key as a path on our own domain", () => {
    expect(imagePath(source)).toBe(`/i/${imageKey(source)}`);
  });
});

describe("the allowed photo source", () => {
  it("accepts FashionGo's CDN", () => {
    expect(isImageSource(source)).toBe(true);
  });

  it("refuses hosts that only look like it", () => {
    for (const url of [
      "https://fg-image.fashiongo.net.evil.example/x.jpg",
      "https://evil.example/fg-image.fashiongo.net/x.jpg",
      "https://evil.example/?u=https://fg-image.fashiongo.net/x.jpg",
      "http://fg-image.fashiongo.net/x.jpg",
      "https://fg-image.fashiongo.net:8080/x.jpg",
      "//fg-image.fashiongo.net/x.jpg",
      "data:image/png;base64,AAAA",
      "not a url",
      "",
    ]) {
      expect(isImageSource(url), url).toBe(false);
    }
  });
});

describe("resolving a key back to a photo", () => {
  it("finds the address the catalog stored for that key", () => {
    expect(imageSourceIn([product], imageKey(source))).toBe(source);
  });

  it("refuses a key no product carries, so /i cannot be used as a proxy", () => {
    expect(imageSourceIn([product], imageKey("https://evil.example/x.jpg"))).toBeNull();
    expect(imageSourceIn([product], "0".repeat(32))).toBeNull();
  });

  it("refuses an address outside FashionGo even if one got stored", () => {
    const tampered = {
      images: [{ url: "/i/abc", sourceUrl: "https://evil.example/x.jpg", color: null }],
    };
    expect(imageSourceIn([tampered], "abc")).toBeNull();
  });
});
