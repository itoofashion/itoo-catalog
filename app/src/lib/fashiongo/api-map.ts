import { catalogPrice } from "@/lib/catalog/pricing";
import type { Product, ProductImage } from "@/lib/catalog/types";
import { imagePath, isImageSource } from "@/lib/images/source";
import { categoryNameOf, dedupeBySku, normalizeTimestamp, sizeLabel } from "./map";

/**
 * FashionGo's published API, and how one of its items becomes a product.
 *
 * This is the second mapping in this directory and it is not a duplicate of the
 * first. map.ts reads the vendor admin's payloads, which is where the shipped
 * seed came from: two requests per style, the size and pack runs held in
 * separate tables that every response repeats, a style's photos arriving
 * separately from the style. The API answers all of that in one item, already
 * assembled, and it names almost every field differently. Mapping it through
 * the old shape would mean inventing a detail response to throw away.
 *
 * What the two share is the far end: both produce lib/catalog/types.ts, and the
 * decisions that belong to the shop rather than to a payload format live in
 * map.ts and are called from here. Prices are discounted the same way, dates are
 * read the same way, styles listed twice are collapsed the same way. If those
 * ever disagree, the shop would show a different catalog depending on where it
 * was imported from, which is the one thing this arrangement must not do.
 */
export type FashionGoApiItem = {
  /** FashionGo's own id for the style. */
  itemId: number;
  /** The vendor style number, e.g. "ITT 8268". This is what the catalog is keyed by. */
  styleCode: string;
  itemName: string | null;
  sellingPrice: number | null;
  /** Pieces in the smallest order the vendor accepts. */
  minTQStyle?: number | null;
  /** The size run, already split: ["S", "M", "L"]. */
  sizeInfo?: { sizeList?: string[] | null } | null;
  /** The pack split, already split: [2, 2, 2]. Null when the style is sold loose. */
  packInfo?: { packList?: number[] | null } | null;
  /** The colors a style comes in. Photos point at these by id. */
  colorList?: { colorId?: number | null; colorName?: string | null }[] | null;
  images?: {
    /** Full size, on FashionGo's CDN, and reachable without a key. */
    imageUrl: string;
    listOrder: number;
    /** Which of the style's colors this photo shows, when the vendor said. */
    colorId?: number | null;
  }[] | null;
  /** A style carries a leaf category; its parent is the one shoppers recognise. */
  categoryId?: number | null;
  parentCategoryId?: number | null;
  parentParentCategoryId?: number | null;
  /** When the vendor uploaded the style. It may sit unpublished for weeks after. */
  createdDate?: string | null;
  /** When the style went live for buyers. This is the date the "New" badge counts from. */
  activatedOn?: string | null;
  /** The API answers with the vendor's whole history, sold styles included. */
  active?: boolean | null;
};

/**
 * The vendor's colors, by id, so a photo can be told which one it shows.
 * A color the vendor left unnamed is left out: an unnamed swatch is worse on a
 * card than no swatch at all.
 */
function colorNames(item: FashionGoApiItem): Map<number, string> {
  const names = new Map<number, string>();
  for (const color of item.colorList ?? []) {
    const name = color?.colorName?.trim();
    if (typeof color?.colorId === "number" && name) names.set(color.colorId, name);
  }
  return names;
}

/**
 * A style's photos, in the order the vendor put them in.
 *
 * A photo becomes ours here, as in map.ts: the catalog stores our own address
 * for it and keeps the FashionGo one only so the image route knows what to
 * download. Anything not on FashionGo's CDN is dropped rather than mapped, so
 * no payload can plant an address the catalog would later hand out.
 *
 * Most photos come with no color on them at all: the vendor only bothers
 * tagging them on the styles where it matters, and roughly one photo in forty
 * carries a color id. An untagged photo stays untagged, which is what the shop
 * has always shown, rather than being attributed to whichever color happens to
 * be the style's only one.
 */
function imagesOf(item: FashionGoApiItem): ProductImage[] {
  const colors = colorNames(item);

  return (item.images ?? [])
    .filter((image) => typeof image?.imageUrl === "string" && image.imageUrl)
    .slice()
    .sort((a, b) => (a.listOrder ?? 0) - (b.listOrder ?? 0))
    .filter((image) => isImageSource(image.imageUrl))
    .map((image) => ({
      url: imagePath(image.imageUrl),
      sourceUrl: image.imageUrl,
      color: (image.colorId != null && colors.get(image.colorId)) || null,
    }));
}

/**
 * How a style is bought: the size run, the pack split and the smallest order.
 *
 * The API hands over both runs already split, which is the whole difference
 * from map.ts, where they had to be looked up in the vendor's tables and split
 * by hand. The rule about the two lining up is the same and is worth keeping:
 * a split that does not match the run cannot be shown per size, and a guess
 * would be worse than saying nothing, so it is dropped and only the total kept.
 *
 * `prePackYN` says the same thing as the presence of packInfo, and agrees with
 * it on every style this vendor has, so it is not read: one source of the answer
 * cannot contradict itself.
 */
function packingOf(item: FashionGoApiItem) {
  const sizes = (item.sizeInfo?.sizeList ?? [])
    .filter((label): label is string => typeof label === "string")
    .map(sizeLabel)
    .filter(Boolean);

  const split = item.packInfo?.packList ?? null;
  const usable =
    Array.isArray(split) &&
    split.length > 0 &&
    split.every((count) => Number.isInteger(count) && count > 0);
  const packBreakdown =
    usable && sizes.length > 0 && split.length === sizes.length ? split : null;

  const stated = item.minTQStyle ?? null;
  const minimumUnits = packBreakdown
    ? packBreakdown.reduce((total, count) => total + count, 0)
    : stated && stated > 0
      ? stated
      : null;

  return { sizes, packBreakdown, minimumUnits };
}

/**
 * When a style was added. The activation date is the day it went on sale, which
 * is what a buyer means by new; the upload date is the fallback for a style that
 * was never activated. Same choice as map.ts makes, under the API's names.
 */
function addedOn(item: FashionGoApiItem): string {
  return normalizeTimestamp(item.activatedOn?.trim() || item.createdDate?.trim() || "");
}

export function mapApiItem(
  item: FashionGoApiItem,
  categories: Map<number, string>,
): Product {
  const sku = item.styleCode.trim();
  const images = imagesOf(item);

  return {
    sku,
    name: item.itemName?.trim() || sku,
    price: catalogPrice(item.sellingPrice ?? 0),
    category: categoryNameOf(
      [item.parentCategoryId, item.categoryId, item.parentParentCategoryId],
      categories,
    ),
    // The colors the shop offers are the ones it can show a photo of. A color
    // the vendor lists but never photographed is a swatch that leads nowhere.
    colors: [...new Set(images.map((image) => image.color).filter((c): c is string => !!c))],
    images,
    ...packingOf(item),
    createdAt: addedOn(item),
    sourceId: item.itemId,
  };
}

/**
 * The catalog, out of everything the API answered with.
 *
 * The API returns the vendor's whole history, some 2,600 styles, and the shop
 * sells the active ones: an inactive style is one the vendor has taken down,
 * and putting it in front of a client is offering something that cannot be
 * ordered. Styles the vendor listed twice are collapsed here for the reason
 * dedupeBySku explains, and the ordering the API answered in is kept.
 */
export function mapApiCatalog(
  items: FashionGoApiItem[],
  categories: Map<number, string>,
): Product[] {
  const active = items.filter((item) => item.active === true);
  return dedupeBySku(active.map((item) => mapApiItem(item, categories)));
}
