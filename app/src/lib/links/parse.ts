import type { CatalogSelection } from "@/lib/catalog/share";

/** How many entries one link may carry — a guard against a junk payload. */
const MAX_ENTRIES = 500;

/**
 * Validates the selection a browser posts before it becomes a link. Nothing here
 * is sensitive, but a link is stored and handed back to other people, so the
 * shape is checked rather than trusted.
 */
export function parseSelection(input: unknown): CatalogSelection | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;

  const record = input as Record<string, unknown>;
  const categories = names(record.categories);
  const skus = names(record.skus);
  if (!categories || !skus) return null;
  if (categories.length === 0 && skus.length === 0) return null;
  if (categories.length + skus.length > MAX_ENTRIES) return null;

  return { categories, skus };
}

function names(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const cleaned = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [...new Set(cleaned)];
}
