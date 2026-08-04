import { isImageKey, isImageSource } from "./source";
import type { ImageStore } from "./store";

/**
 * Serving one product photo, cache-through: from our storage if it is there,
 * otherwise downloaded from FashionGo once, stored, and served.
 *
 * The address to download from never comes from the request — see source.ts for
 * why that matters. It is resolved from the key through the catalog, and checked
 * again here, so the worst a stranger with a made-up key gets is a 404.
 */
export type ImageServeDeps = {
  store: ImageStore;
  /** Resolves a key to the address it was made from, or null if we made no such key. */
  resolveSource: (key: string) => Promise<string | null>;
  /** Injected so tests can assert what does and does not leave the worker. */
  fetchSource?: (url: string) => Promise<Response>;
};

/** Keys are derived from the photo's address, so a key's content never changes. */
const IMMUTABLE = "public, max-age=31536000, immutable";

const DEFAULT_CONTENT_TYPE = "image/jpeg";

/** A product photo is a few hundred kilobytes; anything this big is not one. */
const MAX_BYTES = 10 * 1024 * 1024;

export async function serveImage(key: string, deps: ImageServeDeps): Promise<Response> {
  if (!isImageKey(key)) return missing();

  const stored = await deps.store.get(key);
  if (stored) return served(stored.body, stored.headers.get("content-type"));

  const source = await deps.resolveSource(key);
  if (!source || !isImageSource(source)) return missing();

  const fetchSource = deps.fetchSource ?? fetch;
  let upstream: Response;
  try {
    upstream = await fetchSource(source);
  } catch {
    return unavailable();
  }
  if (!upstream.ok) return unavailable();

  const body = await upstream.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return unavailable();

  const contentType = imageContentType(upstream.headers.get("content-type"));
  await deps.store.put(key, body, contentType);
  return served(body, contentType);
}

/** Whatever the CDN says, this route only ever serves images. */
function imageContentType(header: string | null): string {
  const type = header?.split(";")[0]?.trim().toLowerCase();
  return type?.startsWith("image/") ? type : DEFAULT_CONTENT_TYPE;
}

function served(body: BodyInit | null, contentType: string | null): Response {
  return new Response(body, {
    headers: {
      "content-type": imageContentType(contentType),
      "cache-control": IMMUTABLE,
    },
  });
}

function missing(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}

/**
 * Never cached: FashionGo being unreachable for a moment must not turn into a
 * photo that stays broken until the cache expires.
 */
function unavailable(): Response {
  return new Response("Image unavailable", {
    status: 502,
    headers: { "cache-control": "no-store" },
  });
}
