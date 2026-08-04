import { NextResponse } from "next/server";
import { catalogStore } from "@/lib/catalog/store";
import { parseSyncRequest } from "@/lib/fashiongo/sync-request";

/**
 * Receives what the Chrome extension read out of the FashionGo vendor admin and
 * replaces the catalog with it. A sync is a mirror, not a merge: whatever
 * FashionGo has is what the catalog shows.
 */
export async function POST(request: Request) {
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
  return NextResponse.json({
    count: catalog.products.length,
    syncedAt: catalog.syncedAt,
  });
}

/** The extension checks this before importing, to confirm it found the catalog. */
export async function GET() {
  const { products, syncedAt } = await catalogStore.read();
  return NextResponse.json({ count: products.length, syncedAt });
}
