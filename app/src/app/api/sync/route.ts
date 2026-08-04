import { NextResponse } from "next/server";
import { catalogStore } from "@/lib/catalog/store";
import { parseSyncRequest } from "@/lib/fashiongo/sync-request";
import { authorizeSync } from "@/lib/sync/auth";

/**
 * Receives what the importer read out of FashionGo and replaces the catalog
 * with it. A sync is a mirror, not a merge: whatever FashionGo has is what the
 * catalog shows.
 *
 * There is no GET counterpart on purpose. How many products are loaded and when
 * they were last synced is operational detail, and this endpoint is reachable by
 * anyone who knows the address.
 */
export async function POST(request: Request) {
  const allowed = authorizeSync(request, {
    secret: process.env.SYNC_SECRET,
    isProduction: process.env.NODE_ENV === "production",
  });
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
  return NextResponse.json({ count: catalog.products.length });
}
