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
  filters: Pick<CatalogFilters, "categories" | "newOnly" | "query">,
): PublicProduct[] {
  let result = products;

  const chosen = new Set(filters.categories.filter((name) => name !== ALL_CATEGORIES));
  if (chosen.size > 0) {
    // Together, not one at a time: two ticked categories read as one rack
    // holding both.
    result = result.filter((p) => chosen.has(p.category));
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
  return result;
}

/**
 * How many styles each category would show, counted under the other filters but
 * before the category choice itself. That order is what makes the number an
 * honest promise: with "New" on and "lace" typed, the count beside Dresses is
 * exactly what ticking Dresses will put on screen, whether or not it is ticked.
 */
export function categoryCounts(
  products: PublicProduct[],
  filters: Pick<CatalogFilters, "newOnly" | "query">,
): Map<string, number> {
  const counted = filterProducts(products, { ...filters, categories: [] });
  const counts = new Map<string, number>();
  for (const product of counted) {
    if (!product.category) continue;
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return counts;
}
