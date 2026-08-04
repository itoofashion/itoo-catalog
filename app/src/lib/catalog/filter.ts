import { isNewArrival } from "./arrivals";
import { ALL_CATEGORIES, type CatalogSelection } from "./share";
import type { Product } from "./types";

export type CatalogFilter = CatalogSelection & {
  newOnly?: boolean;
};

/** Categories present in the catalog, "All" first, the rest alphabetical. */
export function categoriesOf(products: Product[]): string[] {
  const names = [...new Set(products.map((p) => p.category).filter(Boolean))];
  names.sort((a, b) => a.localeCompare(b));
  return [ALL_CATEGORIES, ...names];
}

export function filterProducts(
  products: Product[],
  filter: CatalogFilter,
  now: Date,
): Product[] {
  let result = products;

  if (filter.skus.length > 0) {
    const picked = new Set(filter.skus);
    result = result.filter((p) => picked.has(p.sku));
  }
  if (filter.category && filter.category !== ALL_CATEGORIES) {
    result = result.filter((p) => p.category === filter.category);
  }
  if (filter.newOnly) {
    result = result.filter((p) => isNewArrival(p.createdAt, now));
  }
  return result;
}
