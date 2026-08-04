import type { Product } from "@/lib/catalog/types";
import { isImageSource } from "@/lib/images/source";
import { categoryNameMap, dedupeBySku, mapProduct } from "./map";
import type { FashionGoCategory, FashionGoDetail, FashionGoListRecord } from "./types";

/**
 * The importer sends FashionGo's own payloads, untouched, and the mapping to
 * catalog products happens here. Keeping the mapping on the server means there
 * is exactly one implementation of it, and it is the tested one; whatever calls
 * the endpoint stays a dumb pipe that only knows how to read FashionGo.
 *
 * The payload arrives over a public endpoint, so it is validated rather than
 * trusted: a malformed push is rejected whole instead of half-replacing the
 * catalog.
 */
export type SyncRequestResult =
  | { ok: true; products: Product[] }
  | { ok: false; error: string };

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
    // Either date will do: the mapping prefers the activation date and falls
    // back to the upload date, so a record is only unusable when it has neither.
    if (typeof record._activatedOn !== "string" && typeof record._createdOn !== "string") {
      return fail(`${at} (${record.productName}) has no date`);
    }
    // The list thumbnail is the fallback photo, so it is held to the same rule
    // as the detail photos. A product with no thumbnail at all is fine.
    if (record.imageUrl != null && record.imageUrl !== "") {
      if (typeof record.imageUrl !== "string" || !isImageSource(record.imageUrl)) {
        return fail(`${at} (${record.productName}) has a photo from outside FashionGo`);
      }
    }

    const detail = entry.detail == null ? null : parseDetail(entry.detail);
    if (detail === false) {
      return fail(`${at} (${record.productName}) has invalid detail`);
    }

    products.push(
      mapProduct(record as unknown as FashionGoListRecord, detail, categories),
    );
  }

  // A style listed twice is the vendor re-listing it, not a broken push, so it
  // is collapsed rather than rejected (see dedupeBySku).
  return { ok: true, products: dedupeBySku(products) };
}

/** Returns false rather than null when the detail is present but malformed. */
function parseDetail(input: unknown): FashionGoDetail | null | false {
  if (!isRecord(input) || !isRecord(input.item)) return false;

  const images = input.image;
  if (images != null && !Array.isArray(images)) return false;

  for (const image of images ?? []) {
    if (!isRecord(image) || typeof image.imageUrl !== "string") return false;
    // Only FashionGo's own CDN. The image route refuses to download from
    // anywhere else anyway, so this is not what stops a tampered payload. It is
    // what makes it loud: a push carrying foreign addresses is rejected whole
    // instead of quietly producing products with photos that never load.
    if (!isImageSource(image.imageUrl)) return false;
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
