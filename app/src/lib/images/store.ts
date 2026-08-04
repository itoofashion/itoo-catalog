import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Where downloaded product photos are kept.
 *
 * A photo is fetched from FashionGo once and then served from here, so the
 * catalog keeps working, and keeps loading fast, without leaning on a vendor's
 * CDN for every page view. On Cloudflare that is an R2 bucket bound as IMAGES.
 *
 * The binding is optional on purpose. Local development and a deployment made
 * before the bucket exists both fall back to memory: photos are re-downloaded
 * once per isolate instead of the site breaking. Milestone 2's D1 catalog store
 * follows the same shape for the same reason (see lib/catalog/store.ts).
 */
export interface ImageStore {
  get(key: string): Promise<Response | null>;
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  /** Whether a photo is already here, without paying to read it back. */
  has(key: string): Promise<boolean>;
}

const DEFAULT_CONTENT_TYPE = "image/jpeg";

/**
 * Only the part of R2Bucket this uses. Typing it structurally avoids depending
 * on @cloudflare/workers-types here, and it has to be narrowed by hand anyway:
 * the adapter's own CloudflareEnv already declares IMAGES as Cloudflare's image
 * resizing binding, which is not what this binding is.
 */
type ImageBucket = {
  get(key: string): Promise<{
    body: ReadableStream | null;
    httpMetadata?: { contentType?: string };
  } | null>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  head(key: string): Promise<unknown | null>;
};

export function createR2ImageStore(bucket: ImageBucket): ImageStore {
  return {
    async get(key) {
      const object = await bucket.get(key);
      if (!object?.body) return null;
      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType ?? DEFAULT_CONTENT_TYPE,
        },
      });
    },
    async put(key, body, contentType) {
      await bucket.put(key, body, { httpMetadata: { contentType } });
    },
    async has(key) {
      return (await bucket.head(key)) !== null;
    },
  };
}

/**
 * The fallback, and the reason it forgets things: an isolate has a small memory
 * budget it also has to render the catalog with, so the cache is capped and the
 * oldest photos are dropped first. Missing a photo costs one download; running
 * the isolate out of memory costs the whole site.
 */
const MEMORY_LIMIT_BYTES = 24 * 1024 * 1024;

export function createMemoryImageStore(limitBytes = MEMORY_LIMIT_BYTES): ImageStore {
  const held = new Map<string, { body: ArrayBuffer; contentType: string }>();
  let heldBytes = 0;

  return {
    async get(key) {
      const stored = held.get(key);
      if (!stored) return null;
      // A copy, because a Response consumes what it is given and the same photo
      // is served again on the next request.
      return new Response(stored.body.slice(0), {
        headers: { "content-type": stored.contentType },
      });
    },
    async put(key, body, contentType) {
      if (body.byteLength > limitBytes) return;
      const previous = held.get(key);
      if (previous) {
        // Re-inserting also moves the photo to the back of the eviction queue.
        held.delete(key);
        heldBytes -= previous.body.byteLength;
      }
      held.set(key, { body, contentType });
      heldBytes += body.byteLength;
      for (const [oldest, stored] of held) {
        if (heldBytes <= limitBytes) break;
        held.delete(oldest);
        heldBytes -= stored.body.byteLength;
      }
    },
    async has(key) {
      return held.has(key);
    },
  };
}

/**
 * Held on globalThis for the same reason the catalog store is: the page and the
 * image route are bundled separately, so a module-level cache would give each of
 * them its own copy and nothing would ever be a hit.
 */
const STORE_KEY = Symbol.for("itoo.images.store");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: ImageStore };

function sharedMemoryStore(): ImageStore {
  const container = globalThis as GlobalWithStore;
  container[STORE_KEY] ??= createMemoryImageStore();
  return container[STORE_KEY];
}

/**
 * The async form of getCloudflareContext is the one that works everywhere a
 * route can run: the sync form throws unless the worker has already put the
 * context on the global scope. Off Cloudflare entirely (tests, `next build`)
 * it throws, and memory is the answer there too.
 */
async function imageBucket(): Promise<ImageBucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as unknown as Record<string, unknown>).IMAGES;
    return isBucket(binding) ? binding : null;
  } catch {
    return null;
  }
}

function isBucket(value: unknown): value is ImageBucket {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ImageBucket>;
  return (
    typeof candidate.get === "function" &&
    typeof candidate.put === "function" &&
    typeof candidate.head === "function"
  );
}

export async function imageStore(): Promise<ImageStore> {
  const bucket = await imageBucket();
  return bucket ? createR2ImageStore(bucket) : sharedMemoryStore();
}
