import type { Product } from "@/lib/catalog/types";
import { categoryNameMap, mapProduct } from "./map";
import type { FashionGoCategory, FashionGoDetail, FashionGoListRecord } from "./types";

/**
 * The Chrome extension sends FashionGo's own payloads, untouched, and the
 * mapping to catalog products happens here. Keeping the mapping on the server
 * means there is exactly one implementation of it, and it is the tested one —
 * the extension stays a dumb pipe that only knows how to read the vendor admin.
 *
 * The payload arrives from a browser extension, so it is validated rather than
 * trusted: a malformed push is rejected whole instead of half-replacing the
 * catalog.
 */
export type SyncRequestResult =
  | { ok: true; products: Product[] }
  | { ok: false; error: string };

const IMAGE_HOST = "https://fg-image.fashiongo.net/";

export function parseSyncRequest(input: unknown): SyncRequestResult {
  if (!isRecord(input)) return fail("Expected a JSON object");
  if (!Array.isArray(input.categories)) return fail("Expected a categories array");
  if (!Array.isArray(input.products)) return fail("Expected a products array");
  if (input.products.length === 0) {
    return fail("Refusing to replace the catalog with nothing");
  }

  const categories = categoryNameMap(
    input.categories.filter(isCategory) as FashionGoCategory[],
  );

  const products: Product[] = [];
  const seen = new Set<string>();

  for (const [index, entry] of input.products.entries()) {
    const at = `products[${index}]`;
    if (!isRecord(entry) || !isRecord(entry.record)) {
      return fail(`${at} is missing its record`);
    }

    const record = entry.record;
    if (typeof record.productName !== "string" || !record.productName.trim()) {
      return fail(`${at} has no style number`);
    }
    const price = record.sellingPrice ?? record._unitPrice;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      return fail(`${at} (${record.productName}) has an invalid price`);
    }
    if (typeof record._createdOn !== "string") {
      return fail(`${at} (${record.productName}) has no creation date`);
    }

    const detail = entry.detail == null ? null : parseDetail(entry.detail);
    if (detail === false) {
      return fail(`${at} (${record.productName}) has invalid detail`);
    }

    const product = mapProduct(
      record as unknown as FashionGoListRecord,
      detail,
      categories,
    );
    if (seen.has(product.sku)) return fail(`${at} repeats style ${product.sku}`);
    seen.add(product.sku);
    products.push(product);
  }

  return { ok: true, products };
}

/** Returns false — not null — when the detail is present but malformed. */
function parseDetail(input: unknown): FashionGoDetail | null | false {
  if (!isRecord(input) || !isRecord(input.item)) return false;

  const images = input.image;
  if (images != null && !Array.isArray(images)) return false;

  for (const image of images ?? []) {
    if (!isRecord(image) || typeof image.imageUrl !== "string") return false;
    // Only FashionGo's own CDN, so a tampered payload cannot point the catalog
    // at someone else's images.
    if (!image.imageUrl.startsWith(IMAGE_HOST)) return false;
  }

  return input as unknown as FashionGoDetail;
}

function isCategory(value: unknown): boolean {
  return (
    isRecord(value) && typeof value.catID === "number" && typeof value.catName === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): SyncRequestResult {
  return { ok: false, error };
}
