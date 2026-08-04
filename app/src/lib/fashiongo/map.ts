import { catalogPrice } from "@/lib/catalog/pricing";
import type { Product, ProductImage } from "@/lib/catalog/types";
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

function imagesOf(detail: FashionGoDetail | null, fallback: string | null) {
  const images: ProductImage[] = (detail?.image ?? [])
    .filter((image) => image.active && image.imageUrl)
    .sort((a, b) => a.listOrder - b.listOrder)
    .map((image) => ({
      url: largeImageUrl(image.imageUrl),
      color: image.color?.trim() || null,
    }));

  if (images.length === 0 && fallback) {
    images.push({ url: largeImageUrl(fallback), color: null });
  }
  return images;
}

function categoryOf(
  detail: FashionGoDetail | null,
  categories: Map<number, string>,
): string {
  const item = detail?.item;
  // The leaf category is too granular to browse by, so prefer its parent and
  // fall back outwards until something matches the vendor's category list.
  const candidates = [
    item?.parentCategoryId,
    item?.categoryId,
    item?.parentParentCategoryId,
  ];
  for (const id of candidates) {
    if (id != null) {
      const name = categories.get(id);
      if (name) return name;
    }
  }
  return UNCATEGORIZED;
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
    createdAt: normalizeTimestamp(record._createdOn),
    sourceId: record.productId,
  };
}
