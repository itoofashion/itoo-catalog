import type { Catalog } from "@/lib/catalog/types";

/**
 * One style as the admin lists read it: enough to recognise it and act on it,
 * nothing more. Built on the server from the stored catalog — the admin pages
 * are behind the sign-in, so the date and the hidden flag are allowed here in a
 * way they never are in the public payload (see lib/catalog/public.ts).
 */
export type ReviewStyle = {
  sku: string;
  name: string;
  price: number;
  category: string;
  /** Our own /i/ address of the first photo, or null for a style without one. */
  photo: string | null;
  /** The day the style went on sale on FashionGo, ISO 8601. */
  addedAt: string;
  hidden: boolean;
};

export function toReviewStyles(catalog: Catalog, hidden: ReadonlySet<string>): ReviewStyle[] {
  return catalog.products.map((product) => ({
    sku: product.sku,
    name: product.name,
    price: product.price,
    category: product.category,
    photo: product.images[0]?.url ?? null,
    addedAt: product.createdAt,
    hidden: hidden.has(product.sku),
  }));
}

/**
 * Where the arrivals page keeps its chosen day, so a reload answers the same
 * question it was left open on. Written by the browser, read by the server on
 * the way in; not sensitive, so a plain cookie is the whole mechanism.
 */
export const ARRIVALS_COOKIE = "arrivals-after";

/** How far back the arrivals list looks until a day is chosen. */
export const DEFAULT_WINDOW_DAYS = 30;

/** "YYYY-MM-DD" or nothing: a cookie is typed by nobody but still checked. */
export function validDay(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** "YYYY-MM-DD", n days back. */
export function daysAgo(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
