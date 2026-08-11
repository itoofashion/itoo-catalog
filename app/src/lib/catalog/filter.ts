import type { PublicProduct } from "./public";
import {
  ALL_CATEGORIES,
  isEmptySelection,
  type CatalogFilters,
  type CatalogSelection,
} from "./share";

/** Categories present in a set of products, "All" first, the rest alphabetical. */
export function categoriesOf(products: PublicProduct[]): string[] {
  const names = [...new Set(products.map((p) => p.category).filter(Boolean))];
  names.sort((a, b) => a.localeCompare(b));
  return [ALL_CATEGORIES, ...names];
}

/** A style is in the selection either on its own, or through its category. */
export function isSelected(
  product: PublicProduct,
  selection: CatalogSelection,
): boolean {
  return (
    selection.categories.includes(product.category) ||
    selection.skus.includes(product.sku)
  );
}

/**
 * What a visitor can reach at all.
 *
 * With nothing selected that is the whole catalog. Following a shared link it is
 * only what was shared. And because a category is stored as a category rather
 * than as the styles it held at the time, a link to Dresses picks up dresses
 * added after it was sent.
 */
export function selectedProducts(
  products: PublicProduct[],
  selection: CatalogSelection,
): PublicProduct[] {
  if (isEmptySelection(selection)) return products;
  return products.filter((product) => isSelected(product, selection));
}

/** Narrows what is on screen. Filters are a view, not part of the selection. */
export function filterProducts(
  products: PublicProduct[],
  // Paging is not filtering, so the page number is deliberately not asked for.
  filters: Pick<CatalogFilters, "category" | "newOnly" | "query"> & {
    /**
     * "YYYY-MM-DD", inclusive of the day itself. The team's own lens, which is
     * why it is not in CatalogFilters: the address is the link a client gets
     * sent, and a client's products carry no date to read anyway.
     */
    addedAfter?: string | null;
  },
): PublicProduct[] {
  let result = products;

  if (filters.category && filters.category !== ALL_CATEGORIES) {
    result = result.filter((p) => p.category === filters.category);
  }
  if (filters.newOnly) {
    result = result.filter((p) => p.isNew);
  }
  const wanted = filters.query?.trim().toLowerCase();
  if (wanted) {
    // A substring of the name or of the style number, case blind: buyers type
    // "lace" from memory and "y-542" off an order sheet, and both have to land.
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(wanted) || p.sku.toLowerCase().includes(wanted),
    );
  }
  if (filters.addedAfter) {
    // ISO dates compare as strings, day against day. A style with no date at
    // all cannot claim to qualify, so it is dropped rather than guessed at.
    const day = filters.addedAfter;
    result = result.filter((p) => p.addedAt != null && p.addedAt.slice(0, 10) >= day);
  }
  return result;
}
