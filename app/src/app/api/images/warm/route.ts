import { NextResponse } from "next/server";
import { catalogStore } from "@/lib/catalog/store";
import { imageStore } from "@/lib/images/store";
import { warmImages } from "@/lib/images/warm";
import { authorizeSync } from "@/lib/sync/auth";

/**
 * Pulls the catalog's photos into storage a batch at a time.
 *
 * Called by the Chrome extension straight after a sync, over and over until it
 * is told the catalog is covered — a Worker may only make so many outbound
 * requests while serving one request, so this cannot be a single call. It is
 * guarded like syncing is: it costs bandwidth and storage, so it is not
 * something a stranger gets to start.
 */
export const dynamic = "force-dynamic";

/**
 * Photos per call. Kept well under a Worker's outbound-request budget so the
 * same batch size is safe on either Cloudflare plan; the caller loops.
 */
const DEFAULT_BATCH = 40;
const MAX_BATCH = 200;

export async function POST(request: Request) {
  const allowed = authorizeSync(request, {
    secret: process.env.SYNC_SECRET,
    isProduction: process.env.NODE_ENV === "production",
  });
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  const body = await request.json().catch(() => ({}));
  const cursor = positiveInteger(body?.cursor) ?? 0;
  const batch = Math.min(positiveInteger(body?.batch) ?? DEFAULT_BATCH, MAX_BATCH);

  const { products } = await catalogStore.read();
  // Flattened in catalog order, so a cursor keeps its meaning between calls as
  // long as the catalog has not been re-synced underneath it.
  const sources = products.flatMap((product) =>
    product.images.map((image) => image.sourceUrl),
  );

  const progress = await warmImages({
    store: await imageStore(),
    sources,
    batch,
    cursor,
  });

  return NextResponse.json(progress);
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
