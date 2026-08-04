import type { Product, ProductImage } from "./types";

/**
 * Validates what the Chrome extension pushes to /api/sync. The extension runs in
 * someone's browser against a third-party admin panel, so its payload is treated
 * as untrusted input: anything malformed is rejected with a readable reason
 * rather than being written into the catalog half-mapped.
 */
export type SyncPayloadResult =
  | { ok: true; products: Product[] }
  | { ok: false; error: string };

export function parseSyncPayload(input: unknown): SyncPayloadResult {
  if (!isRecord(input)) return fail("Expected a JSON object");
  if (!Array.isArray(input.products)) return fail("Expected a products array");
  if (input.products.length === 0) return fail("Refusing to replace the catalog with nothing");

  const products: Product[] = [];
  const seen = new Set<string>();

  for (const [index, raw] of input.products.entries()) {
    const at = `products[${index}]`;
    if (!isRecord(raw)) return fail(`${at} is not an object`);

    const sku = typeof raw.sku === "string" ? raw.sku.trim() : "";
    if (!sku) return fail(`${at} has no sku`);
    if (seen.has(sku)) return fail(`${at} repeats sku ${sku}`);
    seen.add(sku);

    if (typeof raw.price !== "number" || !Number.isFinite(raw.price) || raw.price < 0) {
      return fail(`${at} (${sku}) has an invalid price`);
    }

    const images = parseImages(raw.images);
    if (!images) return fail(`${at} (${sku}) has invalid images`);

    products.push({
      sku,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : sku,
      price: raw.price,
      category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "Other",
      colors: parseColors(raw.colors),
      images,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      sourceId: typeof raw.sourceId === "number" ? raw.sourceId : 0,
    });
  }

  return { ok: true, products };
}

function parseImages(value: unknown): ProductImage[] | null {
  if (!Array.isArray(value)) return null;
  const images: ProductImage[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.url !== "string") return null;
    // Only the FashionGo CDN is allowed, so a tampered payload cannot turn the
    // catalog into a billboard for someone else's images.
    if (!raw.url.startsWith("https://fg-image.fashiongo.net/")) return null;
    images.push({
      url: raw.url,
      color: typeof raw.color === "string" && raw.color.trim() ? raw.color.trim() : null,
    });
  }
  return images;
}

function parseColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): SyncPayloadResult {
  return { ok: false, error };
}
