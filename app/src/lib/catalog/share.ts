/**
 * The address bar is the product here.
 *
 * A sales person filters the catalog until it shows what a client asked for, and
 * the address they end up on *is* the link they send. So both halves live in the
 * query string: what was picked for the client, and how the page is filtered.
 *
 * Picking a whole category rather than its items is a deliberate difference:
 * a category link keeps meaning "everything in Dresses", so styles added next
 * week appear in a link that was sent last week.
 */
export type CatalogSelection = {
  /** Whole categories, chosen by their checkbox. */
  categories: string[];
  /** Individually picked styles. */
  skus: string[];
};

export type CatalogFilters = {
  /** Which category the grid is narrowed to, or null for all of them. */
  category: string | null;
  newOnly: boolean;
  /** What was typed into the search box, or null for nothing. */
  query: string | null;
  /** 1-based. In the address so a link opens on the page it was sent from. */
  page: number;
};

export const ALL_CATEGORIES = "All";

export const EMPTY_SELECTION: CatalogSelection = { categories: [], skus: [] };
export const NO_FILTERS: CatalogFilters = {
  category: null,
  newOnly: false,
  query: null,
  page: 1,
};

const SEPARATOR = ",";

export function isEmptySelection(selection: CatalogSelection): boolean {
  return selection.categories.length === 0 && selection.skus.length === 0;
}

export function selectionSize(selection: CatalogSelection): number {
  return selection.categories.length + selection.skus.length;
}

/**
 * Ticking a category is the checkbox in a table's column header: it owns every
 * row under it. Styles of that category that had been ticked one by one are
 * absorbed by it, so the same style is never in the link twice, the count never
 * doubles, and unticking the category takes everything it swallowed with it.
 *
 * The other half of that behaviour lives on the card: inside a ticked category
 * the individual boxes are shown ticked but cannot be pressed. Letting one style
 * be un-ticked would mean dropping the category and listing the rest of it by
 * hand, which turns "all of Dresses" into two hundred style numbers in the
 * address and quietly changes what the link promises: a category link keeps
 * meaning "everything in Dresses", including styles added after it was sent.
 */
export function toggleCategory(
  selection: CatalogSelection,
  category: string,
  /** Every style currently in that category. */
  skusInCategory: string[],
): CatalogSelection {
  if (selection.categories.includes(category)) {
    // Whatever the category absorbed on the way in went with it; nothing of it
    // is left hanging around individually.
    return {
      categories: selection.categories.filter((name) => name !== category),
      skus: selection.skus,
    };
  }

  const absorbed = new Set(skusInCategory);
  return {
    categories: [...selection.categories, category],
    skus: selection.skus.filter((sku) => !absorbed.has(sku)),
  };
}

/** Ticking a single style. Styles of a ticked category never get here. */
export function toggleStyle(selection: CatalogSelection, sku: string): CatalogSelection {
  return {
    ...selection,
    skus: selection.skus.includes(sku)
      ? selection.skus.filter((value) => value !== sku)
      : [...selection.skus, sku],
  };
}

export function buildCatalogQuery(
  selection: CatalogSelection,
  filters: CatalogFilters = NO_FILTERS,
): string {
  const params = new URLSearchParams();
  if (selection.categories.length > 0) {
    params.set("cats", selection.categories.join(SEPARATOR));
  }
  if (selection.skus.length > 0) {
    params.set("items", selection.skus.join(SEPARATOR));
  }
  if (filters.category && filters.category !== ALL_CATEGORIES) {
    params.set("show", filters.category);
  }
  if (filters.newOnly) {
    params.set("new", "1");
  }
  if (filters.query?.trim()) {
    params.set("q", filters.query.trim());
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function parseCatalogQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): { selection: CatalogSelection; filters: CatalogFilters } {
  const params = input instanceof URLSearchParams ? input : toSearchParams(input);

  return {
    selection: {
      categories: list(params.get("cats")),
      skus: list(params.get("items")),
    },
    filters: {
      category: clean(params.get("show")),
      newOnly: params.get("new") === "1",
      query: text(params.get("q")),
      page: pageNumber(params.get("page")),
    },
  };
}

function list(value: string | null): string[] {
  return (value ?? "")
    .split(SEPARATOR)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pageNumber(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return !trimmed || trimmed === ALL_CATEGORIES ? null : trimmed;
}

/** Not clean(): a visitor searching for the word "All" means the word. */
function text(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function toSearchParams(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params;
}
