import { NextResponse } from "next/server";
import { catalogStore } from "@/lib/catalog/store";
import { parseSyncRequest } from "@/lib/fashiongo/sync-request";
import { authorizeSync } from "@/lib/sync/auth";
import { syncState } from "@/lib/sync/state";

/**
 * Receives what the importer read out of FashionGo and replaces the catalog
 * with it. A sync is a mirror, not a merge: whatever FashionGo has is what the
 * catalog shows.
 *
 * GET is the other half of the "Sync now" button: the button leaves a note (see
 * lib/sync/state.ts), and the puller asks here every minute whether one is
 * waiting. It answers only whether a sync is wanted, and only to the holder of
 * the sync secret: how many products are loaded and when they were last synced
 * is operational detail, and this endpoint is reachable by anyone who knows the
 * address.
 */
export async function GET(request: Request) {
  const allowed = authorize(request);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  const { requestedAt } = await (await syncState()).read();
  return NextResponse.json({ pending: requestedAt !== null, requestedAt });
}

export async function POST(request: Request) {
  const allowed = authorize(request);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = parseSyncRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const catalog = await catalogStore.replace(parsed.products);

  // The record the admin panel prints, and the answer to any pending request:
  // whoever pressed the button was asking for the catalog this push just
  // delivered, a request made while it was in flight included.
  await (await syncState()).complete({
    finishedAt: new Date().toISOString(),
    styleCount: catalog.products.length,
  });

  return NextResponse.json({ count: catalog.products.length });
}

function authorize(request: Request) {
  return authorizeSync(request, {
    secret: process.env.SYNC_SECRET,
    isProduction: process.env.NODE_ENV === "production",
  });
}
