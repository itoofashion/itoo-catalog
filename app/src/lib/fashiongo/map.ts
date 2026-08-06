import { catalogPrice } from "@/lib/catalog/pricing";
import type { Product, ProductImage } from "@/lib/catalog/types";
import { imagePath, isImageSource } from "@/lib/images/source";
import type {
  FashionGoCategory,
  FashionGoDetail,
  FashionGoListRecord,
} from "./types";

export const UNCATEGORIZED = "Other";

/** FashionGo appends a product count to category names: "Tops (299) ". */
export function categoryNameMap(
  categories: FashionGoCategory[],
): Map<number, string> {
  const map = new Map<number, string>();
  for (const { catID, catName } of categories) {
    const name = catName.replace(/\s*\(\d+\)\s*$/, "").trim();
    if (name) map.set(catID, name);
  }
  return map;
}

/**
 * FashionGo timestamps come back without a timezone ("2026-07-28T15:02:43.153")
 * and are UTC. Left alone, JS would read them as local time and shift the date.
 */
export function normalizeTimestamp(value: string): string {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = new Date(hasTimezone ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/** The CDN serves several sizes; the catalog always wants the large one. */
export function largeImageUrl(url: string): string {
  return url.replace("/ProductImage/list/", "/ProductImage/large/");
}

/**
 * A photo becomes ours here: the catalog stores our own address for it and
 * keeps the FashionGo one only so the image route knows what to download.
 * Anything not on FashionGo's CDN is dropped rather than mapped, so no payload
 * can plant an address the catalog would later hand out.
 */
function imageOf(sourceUrl: string, color: string | null): ProductImage | null {
  const source = largeImageUrl(sourceUrl);
  if (!isImageSource(source)) return null;
  return { url: imagePath(source), sourceUrl: source, color };
}

function imagesOf(detail: FashionGoDetail | null, fallback: string | null) {
  const images: ProductImage[] = (detail?.image ?? [])
    .filter((image) => image.active && image.imageUrl)
    .sort((a, b) => a.listOrder - b.listOrder)
    .map((image) => imageOf(image.imageUrl, image.color?.trim() || null))
    .filter((image): image is ProductImage => image !== null);

  if (images.length === 0 && fallback) {
    const image = imageOf(fallback, null);
    if (image) images.push(image);
  }
  return images;
}

/**
 * FashionGo writes a one-size run as "O~S". It is a code, not something a buyer
 * would recognise on a product card, so it is spelled out on the way in.
 */
const ONE_SIZE_CODE = "O~S";

/** One label of a size run, as a buyer should read it. */
export function sizeLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed.toUpperCase() === ONE_SIZE_CODE ? "One Size" : trimmed;
}

/**
 * A size run: "S;M;L" is how FashionGo's own admin stores and splits it. The
 * argument is typed loose because these tables arrive over the network, where
 * nothing guarantees FashionGo put a string there.
 */
function sizeRunOf(description: unknown): string[] {
  if (typeof description !== "string") return [];
  return description.split(";").map(sizeLabel).filter(Boolean);
}

/** A pack split like "2-2-2": one positive count per size in the run. */
function packSplitOf(description: unknown): number[] | null {
  if (typeof description !== "string") return null;
  const counts = description.split("-").map((part) => Number(part.trim()));
  if (counts.some((count) => !Number.isInteger(count) || count <= 0)) return null;
  return counts;
}

/**
 * How a style is bought: the size run, the pack split and the smallest order.
 *
 * None of it is stored on the product. The product carries a `sizeId` and a
 * `packId`, and the vendor's whole size and pack tables ride along with every
 * detail response, so the values have to be looked up. The two rows line up
 * position by position: run "S;M;L" against split "2-2-2" is two smalls, two
 * mediums and two larges, six pieces in the smallest order a buyer can place.
 */
function packingOf(record: FashionGoListRecord, detail: FashionGoDetail | null) {
  const sizeId = detail?.item.sizeId ?? record.sizeId;
  // No pack reads as 0 from the detail and as null from the list; both mean the
  // style is sold loose, with the buyer free to choose sizes up to the minimum.
  const packId = detail?.item.packId || record.packId || null;

  const sizeTable = Array.isArray(detail?.size) ? detail.size : [];
  const packTable = Array.isArray(detail?.pack) ? detail.pack : [];

  const size = sizeId ? sizeTable.find((row) => row?.sizeId === sizeId) : null;
  const sizes = sizeRunOf(size?.sizeDescription2);

  const pack = packId ? packTable.find((row) => row?.packId === packId) : null;
  const split = packSplitOf(pack?.packDescription);
  // A split that does not line up with the run cannot be shown per size, and a
  // guess would be worse than saying nothing: drop it and keep the total.
  const packBreakdown =
    split && sizes.length > 0 && split.length === sizes.length ? split : null;

  const stated = detail?.item.minTQStyle ?? null;
  const minimumUnits = packBreakdown
    ? packBreakdown.reduce((total, count) => total + count, 0)
    : stated && stated > 0
      ? stated
      : null;

  return { sizes, packBreakdown, minimumUnits };
}

/**
 * When a style was added, as the vendor admin itself reports it: the admin's
 * product list shows `_activatedOn` and drives its own "new" ribbon from it,
 * while `_createdOn` is the upload date, which for a style that sat unpublished
 * can be weeks earlier. Buyers care about the day it went on sale, so that is
 * the date the "New" badge counts from. `_createdOn` is the fallback for records
 * that were never activated.
 */
function addedOn(record: FashionGoListRecord): string {
  return normalizeTimestamp(record._activatedOn?.trim() || record._createdOn || "");
}

/**
 * The name to file a style under, from the category ids it carries.
 *
 * The leaf category is too granular to browse by, so the caller offers its
 * parent first and the fallbacks outwards from there; the first id the vendor's
 * own category list knows a name for wins. A style whose categories are all
 * unknown is filed under UNCATEGORIZED rather than under a guess.
 */
export function categoryNameOf(
  candidates: (number | null | undefined)[],
  categories: Map<number, string>,
): string {
  for (const id of candidates) {
    if (id != null) {
      const name = categories.get(id);
      if (name) return name;
    }
  }
  return UNCATEGORIZED;
}

function categoryOf(
  detail: FashionGoDetail | null,
  categories: Map<number, string>,
): string {
  const item = detail?.item;
  return categoryNameOf(
    [item?.parentCategoryId, item?.categoryId, item?.parentParentCategoryId],
    categories,
  );
}

/**
 * Collapses styles the vendor listed more than once.
 *
 * The catalog is keyed by style number; FashionGo is keyed by its own product
 * id, and re-listing a style there means uploading it again under the same
 * number. 37 of this vendor's 775 active styles are such re-uploads, sometimes
 * with a stale name or an old price. The listing that went on sale last is the
 * one clients can actually order, so it wins and the rest are dropped.
 */
export function dedupeBySku(products: Product[]): Product[] {
  const bySku = new Map<string, Product>();

  for (const product of products) {
    const listed = bySku.get(product.sku);
    // Re-setting an existing key keeps its position, so the vendor's own
    // ordering survives even when a later entry replaces an earlier one.
    if (!listed || addedAfter(product, listed)) bySku.set(product.sku, product);
  }

  return [...bySku.values()];
}

function addedAfter(product: Product, other: Product): boolean {
  const added = new Date(product.createdAt).getTime();
  const existing = new Date(other.createdAt).getTime();
  // An unreadable date never displaces a readable one.
  return added > existing;
}

export function mapProduct(
  record: FashionGoListRecord,
  detail: FashionGoDetail | null,
  categories: Map<number, string>,
): Product {
  const sourcePrice = record.sellingPrice ?? record._unitPrice ?? 0;
  const images = imagesOf(detail, record.imageUrl);
  const colors = [
    ...new Set(images.map((image) => image.color).filter((c): c is string => !!c)),
  ];

  return {
    sku: record.productName.trim(),
    name: record.itemName?.trim() || record.productName.trim(),
    price: catalogPrice(sourcePrice),
    category: categoryOf(detail, categories),
    colors,
    images,
    ...packingOf(record, detail),
    createdAt: addedOn(record),
    sourceId: record.productId,
  };
}
