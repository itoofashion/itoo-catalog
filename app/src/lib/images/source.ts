import { createHash } from "node:crypto";
import type { Product } from "@/lib/catalog/types";

/**
 * Where product photos come from, and how they get an address of our own.
 *
 * Photos used to be linked straight to FashionGo's CDN. That tied the catalog to
 * a vendor's infrastructure, and it published FashionGo's internal product id in
 * every photo address — their files are named "<productId>_a.jpg". Photos are now
 * served from our own domain, from /i/<key>, and cached in R2.
 *
 * The key is a hash of the source address, which is what keeps /i from becoming
 * an open proxy: a request never carries the address to download from, so nobody
 * can point us at a URL of their choosing. The route resolves a key back to an
 * address only through the catalog, and only addresses on FashionGo's CDN are
 * ever fetched. The hash is one-way, so the address — product id and all — cannot
 * be read back out of the key either.
 */
export const IMAGE_SOURCE_ORIGIN = "https://fg-image.fashiongo.net";

/** 128 bits of a SHA-256. Short enough to read, long enough never to collide. */
const KEY_LENGTH = 32;

const KEY_PATTERN = /^[0-9a-f]{32}$/;

/**
 * Parsed rather than prefix-matched: a string test would accept addresses like
 * "https://fg-image.fashiongo.net.example.com/x.jpg", which is somebody else's
 * host entirely.
 */
export function isImageSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}` === IMAGE_SOURCE_ORIGIN;
  } catch {
    return false;
  }
}

export function imageKey(sourceUrl: string): string {
  return createHash("sha256").update(sourceUrl).digest("hex").slice(0, KEY_LENGTH);
}

export function isImageKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/** The address the catalog publishes for a photo. */
export function imagePath(sourceUrl: string): string {
  return `/i/${imageKey(sourceUrl)}`;
}

/**
 * Resolves a key back to the address it was made from.
 *
 * The catalog is the only place that mapping exists, so a key that no product
 * carries is simply not downloadable — the amount of traffic and storage a
 * stranger can make us spend is bounded by what the vendor actually published.
 * The host is checked again here rather than trusted: whatever a sync stored is
 * still data that arrived over the network.
 */
export function imageSourceIn(
  products: Pick<Product, "images">[],
  key: string,
): string | null {
  const path = `/i/${key}`;
  for (const product of products) {
    for (const image of product.images) {
      if (image.url === path && isImageSource(image.sourceUrl)) return image.sourceUrl;
    }
  }
  return null;
}
