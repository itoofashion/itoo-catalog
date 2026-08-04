import type { CatalogSelection } from "@/lib/catalog/share";

/**
 * A short link that carries its own meaning.
 *
 * The obvious design — mint a random six-character code and remember what it
 * points at — needs somewhere to remember it. On Cloudflare a Worker is many
 * isolates: the link is created in one and opened in another, so anything held
 * in memory is a link that works for whoever made it and 404s for the client it
 * was sent to. That is worse than a long link.
 *
 * So the code *is* the selection, encoded: categories and styles packed into
 * one token and base64url'd. It stays short for the common case (one category
 * is a dozen characters), it cannot go stale, and it needs no database. When
 * Milestone 2 brings one, this can become a real six-character key without the
 * links already sent breaking — they decode on their own.
 */
const GROUP_SEPARATOR = "!";
const ITEM_SEPARATOR = "~";

export function encodeSelection(selection: CatalogSelection): string {
  const payload = [
    selection.categories.join(ITEM_SEPARATOR),
    selection.skus.join(ITEM_SEPARATOR),
  ].join(GROUP_SEPARATOR);

  return base64UrlEncode(payload);
}

export function decodeSelection(code: string): CatalogSelection | null {
  const payload = base64UrlDecode(code.trim());
  if (payload === null) return null;

  const [categories = "", skus = ""] = payload.split(GROUP_SEPARATOR);
  const selection = {
    categories: split(categories),
    skus: split(skus),
  };

  // A code that decodes to nothing is a broken link, not the whole catalog.
  if (selection.categories.length === 0 && selection.skus.length === 0) return null;
  return selection;
}

function split(value: string): string[] {
  return value
    .split(ITEM_SEPARATOR)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(code: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const padded = code.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
