import { seedCategoryNames } from "@/lib/catalog/seed";
import type { Product } from "@/lib/catalog/types";
import { isImageSource } from "@/lib/images/source";
import { mapApiCatalog, type FashionGoApiItem } from "./api-map";

/**
 * What a sync pushes, and what it has to look like to be believed.
 *
 * The importer sends FashionGo's own items, untouched, and the mapping to
 * catalog products happens here. Keeping the mapping on the server means there
 * is exactly one implementation of it, and it is the tested one; the importer
 * stays a dumb pipe that only knows how to page through FashionGo and how to
 * reach us. It has to be a pipe of its own rather than the Worker calling
 * FashionGo directly, because FashionGo answers a whitelisted address and a
 * Worker has no fixed one.
 *
 * The payload arrives over a public endpoint, so it is validated rather than
 * trusted: a malformed push is rejected whole instead of half-replacing the
 * catalog.
 */
export type SyncRequestResult =
  | { ok: true; products: Product[] }
  | { ok: false; error: string };

export function parseSyncRequest(
  input: unknown,
  categories: Map<number, string> = seedCategoryNames(),
): SyncRequestResult {
  if (!isRecord(input)) return fail("Expected a JSON object");
  if (!Array.isArray(input.items)) return fail("Expected an items array");

  // FashionGo answers with the vendor's whole history, and the importer is
  // meant to have dropped the styles that are no longer for sale. Whatever is
  // left of them is skipped here rather than checked: a style taken down years
  // ago is not something the shop should be refused over.
  const active = input.items.filter(
    (item): item is Record<string, unknown> => isRecord(item) && item.active === true,
  );

  if (active.length === 0) {
    return fail("Refusing to replace the catalog with nothing");
  }

  for (const [index, item] of active.entries()) {
    const problem = checkItem(item, `items[${index}]`);
    if (problem) return fail(problem);
  }

  return {
    ok: true,
    products: mapApiCatalog(active as unknown as FashionGoApiItem[], categories),
  };
}

/** The reason this item cannot become a product, or null if it can. */
function checkItem(item: Record<string, unknown>, at: string): string | null {
  if (typeof item.styleCode !== "string" || !item.styleCode.trim()) {
    return `${at} has no style number`;
  }
  const style = `${at} (${item.styleCode.trim()})`;

  if (typeof item.itemId !== "number" || !Number.isFinite(item.itemId)) {
    return `${style} has no item id`;
  }

  const price = item.sellingPrice;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return `${style} has an invalid price`;
  }

  // Either date will do: the mapping prefers the day the style went on sale and
  // falls back to the day it was uploaded, so an item is only unusable when it
  // has neither.
  if (typeof item.activatedOn !== "string" && typeof item.createdDate !== "string") {
    return `${style} has no date`;
  }

  if (item.images != null && !Array.isArray(item.images)) {
    return `${style} has an invalid photo list`;
  }
  for (const image of (item.images as unknown[]) ?? []) {
    if (!isRecord(image) || typeof image.imageUrl !== "string") {
      return `${style} has an invalid photo`;
    }
    // Only FashionGo's own CDN. The image route refuses to download from
    // anywhere else anyway, so this is not what stops a tampered payload. It is
    // what makes it loud: a push carrying foreign addresses is rejected whole
    // instead of quietly producing products with photos that never load.
    if (!isImageSource(image.imageUrl)) {
      return `${style} has a photo from outside FashionGo`;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): SyncRequestResult {
  return { ok: false, error };
}
