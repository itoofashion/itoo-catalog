/**
 * A client link carries what the sales team picked: either a whole category or a
 * hand-picked set of items. It is encoded in the query string so the link stays
 * readable and needs no server-side state.
 */
export type CatalogSelection = {
  skus: string[];
  category: string | null;
};

export const ALL_CATEGORIES = "All";

const SKU_SEPARATOR = ",";

export function buildShareQuery(selection: CatalogSelection): string {
  const params = new URLSearchParams();
  if (selection.category && selection.category !== ALL_CATEGORIES) {
    params.set("category", selection.category);
  }
  if (selection.skus.length > 0) {
    params.set("items", selection.skus.join(SKU_SEPARATOR));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function parseShareQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): CatalogSelection {
  const params =
    input instanceof URLSearchParams ? input : searchParamsFromRecord(input);

  const items = params.get("items") ?? "";
  const skus = items
    .split(SKU_SEPARATOR)
    .map((sku) => sku.trim())
    .filter(Boolean);

  const category = params.get("category")?.trim() || null;

  return {
    skus,
    category: category === ALL_CATEGORIES ? null : category,
  };
}

function searchParamsFromRecord(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params;
}
