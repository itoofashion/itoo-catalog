import type { CatalogFilters, CatalogSelection } from "./share";

/**
 * Addresses a person can read.
 *
 * Category and color names are written by hand in the vendor admin, so they hold
 * ampersands, slashes and double spaces. Putting them in a link raw turns
 * "Jumpsuits & Rompers" into a run of percent signs, which is what a client sees
 * when the link lands in their chat. A slug is what goes in the address instead.
 *
 * Slugging is one-way on purpose: "jumpsuits-rompers" cannot be spelled back
 * into "Jumpsuits & Rompers" by any rule. So the way back is to ask the catalog,
 * which is the only thing that knows the real names, and that is what every
 * resolve function here takes its list of names for.
 */

/** "Jumpsuits & Rompers" to "jumpsuits-rompers". */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The real name a slug stands for, or null when the catalog holds no such thing.
 *
 * An exact name is taken first, so addresses that were sent before slugs existed
 * ("?cats=Dresses", and the raw "?cats=Jumpsuits%20%26%20Rompers" with it) keep
 * opening what they always opened.
 */
export function resolveSlug(
  value: string | null | undefined,
  names: readonly string[],
): string | null {
  const wanted = (value ?? "").trim();
  if (!wanted) return null;
  if (names.includes(wanted)) return wanted;
  const slug = toSlug(wanted);
  return names.find((name) => toSlug(name) === slug) ?? null;
}

/** A style number in the address, and the way back from it. */
export type ProductSlugs = {
  slugOf(sku: string): string;
  skuOf(slug: string): string | null;
};

/** Style numbers are unique, and a slug of one has to be unique too. */
const SUFFIX_START = 2;

/** For a style number with no letter or digit in it at all. */
const FALLBACK_SLUG = "style";

/**
 * The slug of every style in the catalog, and the map back.
 *
 * Style numbers are unique across the catalog, but slugging drops the difference
 * between "WP-2142" and "WP 2142", and between "1191 NEW" and "1191  NEW". Two
 * styles cannot share an address, so the second one to claim a slug takes a "-2"
 * after it.
 *
 * Which of the two is second must never depend on the order the catalog happened
 * to arrive in: an address that moves between deployments is a link that dies in
 * somebody's chat. So the numbers are sorted before they are handed out, and the
 * sort is a total order over distinct strings, which makes the whole map a
 * function of the set of style numbers and nothing else.
 */
export function productSlugs(products: readonly { sku: string }[]): ProductSlugs {
  const bySku = new Map<string, string>();
  const bySlug = new Map<string, string>();
  const skus = [...new Set(products.map((product) => product.sku))].sort();

  for (const sku of skus) {
    const base = toSlug(sku) || FALLBACK_SLUG;
    let slug = base;
    for (let suffix = SUFFIX_START; bySlug.has(slug); suffix += 1) {
      slug = `${base}-${suffix}`;
    }
    bySlug.set(slug, sku);
    bySku.set(sku, slug);
  }

  return {
    slugOf: (sku) => bySku.get(sku) ?? toSlug(sku),
    // A style number typed in as it is printed is an address too.
    skuOf: (slug) => bySlug.get(slug) ?? (bySku.has(slug) ? slug : null),
  };
}

/** Where a single style lives: /p/y-542?c=beige. */
export function productAddress(slug: string, color: string | null): string {
  const query = color ? `?c=${encodeURIComponent(toSlug(color))}` : "";
  return `/p/${encodeURIComponent(slug)}${query}`;
}

/** What a product address says, or null when the address is a catalog one. */
export function readProductAddress(
  pathname: string,
  search: string,
): { slug: string; color: string | null } | null {
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  return {
    slug: decodeURIComponent(match[1]),
    color: new URLSearchParams(search).get("c"),
  };
}

/** Both halves of the catalog address, as the page holds them. */
export type CatalogAddress = { selection: CatalogSelection; filters: CatalogFilters };

/** Real names to slugs, on the way into the address bar. */
export function slugifyCategories({ selection, filters }: CatalogAddress): CatalogAddress {
  return {
    selection: { ...selection, categories: selection.categories.map(toSlug) },
    filters: { ...filters, category: filters.category ? toSlug(filters.category) : null },
  };
}

/**
 * Slugs back to real names, on the way out of the address bar.
 *
 * A slug that names no category is left as it came: it then matches no product,
 * which shows an empty selection rather than quietly widening a client's link to
 * the whole catalog.
 */
export function resolveCategories(
  { selection, filters }: CatalogAddress,
  categories: readonly string[],
): CatalogAddress {
  return {
    selection: {
      ...selection,
      categories: selection.categories.map((value) => resolveSlug(value, categories) ?? value),
    },
    filters: {
      ...filters,
      category: filters.category
        ? (resolveSlug(filters.category, categories) ?? filters.category)
        : null,
    },
  };
}
