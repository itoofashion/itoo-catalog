import type { CatalogSelection } from "@/lib/catalog/share";

/**
 * The links sent before there was a database.
 *
 * Minting a random code and remembering what it points at needs somewhere to
 * remember it, and the pilot had nowhere: on Cloudflare a Worker is many
 * isolates, so a code held in memory works for whoever made it and 404s for the
 * client it was sent to. The way out was to make the code *be* the selection,
 * base64url'd, which needs nothing to remember it but produces the link the
 * client called a nightmare:
 *
 *   /s/RHJlc3Nlc35DbHV0Y2hlcyAmIFBvdWNoZXMhODk4MH5XUC0yMTYw
 *
 * New links are six characters and live in D1 (see store.ts). This stays as the
 * fallback path, and only that: links of this shape are already in people's
 * chats, and they decode on their own, so they keep working forever at the cost
 * of one function. Nothing mints them any more; the encoder is kept because a
 * decoder with no way to produce its input cannot be tested.
 */
const GROUP_SEPARATOR = "!";
const ITEM_SEPARATOR = "~";

export function encodeLegacyCode(selection: CatalogSelection): string {
  const payload = [
    selection.categories.join(ITEM_SEPARATOR),
    selection.skus.join(ITEM_SEPARATOR),
  ].join(GROUP_SEPARATOR);

  return base64UrlEncode(payload);
}

export function decodeLegacyCode(code: string): CatalogSelection | null {
  const payload = base64UrlDecode(code.trim());
  if (payload === null) return null;

  // Being the last thing asked makes this fussy on purpose. Six random
  // characters are also valid base64, so a mistyped short code arrives here and
  // decodes into three bytes of noise; without these two checks that noise
  // would pass for a category name and the visitor would get an empty catalog
  // instead of a 404. A real code of this kind always holds the separator, and
  // never holds a control character.
  if (!payload.includes(GROUP_SEPARATOR)) return null;
  if (/[\u0000-\u001f]/.test(payload)) return null;

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
    // Fatal, so bytes that are not text at all are refused here rather than
    // turning into replacement characters and passing for a category name.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
