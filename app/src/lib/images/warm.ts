import { imageKey } from "./source";
import type { ImageStore } from "./store";

/**
 * Pulling photos into storage as part of a sync, rather than waiting for a
 * client to open them.
 *
 * The catalog is around six thousand photos and a Worker may only make so many
 * outbound requests while handling one request of its own, so warming happens in
 * batches: each call takes over where the last one stopped and reports where it
 * got to. The caller — the Chrome extension, right after it pushes a sync —
 * keeps calling until it is told the catalog is covered.
 *
 * Photos already in storage are skipped, and a photo's address is what its key
 * is made from, so re-running this over a catalog that has not changed costs
 * one existence check per photo and downloads nothing.
 */
export type WarmProgress = {
  /** Where to resume from; pass it back on the next call. */
  cursor: number;
  /** Photos fetched from FashionGo during this call. */
  downloaded: number;
  /** Photos that were already stored. */
  skipped: number;
  /** Photos that could not be fetched — they are left for a later run. */
  failed: number;
  /** Nothing left to warm. */
  done: boolean;
  total: number;
};

export type WarmDeps = {
  store: ImageStore;
  /** Every photo address in the catalog, in a stable order. */
  sources: string[];
  /** How many photos this call may download before handing back a cursor. */
  batch: number;
  cursor?: number;
  /**
   * Downloads in flight at once. These are almost entirely waiting on the
   * network, so doing them one at a time makes warming take minutes it does not
   * need to — six at a time is a fivefold difference over the whole catalog.
   */
  concurrency?: number;
  fetchSource?: (url: string) => Promise<Response>;
};

/** A product photo is a few hundred kilobytes; anything this big is not one. */
const MAX_BYTES = 10 * 1024 * 1024;

const DEFAULT_CONTENT_TYPE = "image/jpeg";

const DEFAULT_CONCURRENCY = 6;

export async function warmImages(deps: WarmDeps): Promise<WarmProgress> {
  const { store, sources, batch } = deps;
  const fetchSource = deps.fetchSource ?? fetch;
  const total = sources.length;
  // Never wider than the batch, so a caller asking for two photos gets two.
  const width = Math.max(1, Math.min(deps.concurrency ?? DEFAULT_CONCURRENCY, batch));

  let cursor = Math.max(0, Math.min(deps.cursor ?? 0, total));
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  while (cursor < total && downloaded < batch) {
    const window = sources.slice(cursor, cursor + width);
    const outcomes = await Promise.all(
      window.map((source) => warmOne(source, store, fetchSource)),
    );

    for (const outcome of outcomes) {
      if (outcome === "downloaded") downloaded += 1;
      else if (outcome === "skipped") skipped += 1;
      else failed += 1;
    }
    cursor += window.length;
  }

  return { cursor, downloaded, skipped, failed, done: cursor >= total, total };
}

type Outcome = "downloaded" | "skipped" | "failed";

async function warmOne(
  source: string,
  store: ImageStore,
  fetchSource: (url: string) => Promise<Response>,
): Promise<Outcome> {
  const key = imageKey(source);
  if (await store.has(key)) return "skipped";

  try {
    const upstream = await fetchSource(source);
    if (!upstream.ok) return "failed";

    const body = await upstream.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return "failed";

    await store.put(key, body, contentTypeOf(upstream));
    return "downloaded";
  } catch {
    // A photo that will not download is not worth failing the whole batch over:
    // the next run tries it again, and the catalog still renders because the
    // image route falls back to fetching it on demand.
    return "failed";
  }
}

function contentTypeOf(response: Response): string {
  const declared = response.headers.get("content-type")?.split(";")[0]?.trim();
  return declared?.startsWith("image/") ? declared : DEFAULT_CONTENT_TYPE;
}
