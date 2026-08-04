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
  /** 1-based. In the address so a link opens on the page it was sent from. */
  page: number;
};

export const ALL_CATEGORIES = "All";

export const EMPTY_SELECTION: CatalogSelection = { categories: [], skus: [] };
export const NO_FILTERS: CatalogFilters = { category: null, newOnly: false, page: 1 };

const SEPARATOR = ",";

export function isEmptySelection(selection: CatalogSelection): boolean {
  return selection.categories.length === 0 && selection.skus.length === 0;
}

export function selectionSize(selection: CatalogSelection): number {
  return selection.categories.length + selection.skus.length;
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
