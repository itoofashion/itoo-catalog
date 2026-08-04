import { NextResponse } from "next/server";
import { parseSyncPayload } from "@/lib/catalog/sync-payload";
import { catalogStore } from "@/lib/catalog/store";

/**
 * Receives the products the Chrome extension read out of FashionGo and replaces
 * the catalog with them. A sync is a mirror, not a merge: what FashionGo has is
 * what the catalog shows.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = parseSyncPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const catalog = await catalogStore.replace(parsed.products);
  return NextResponse.json({
    count: catalog.products.length,
    syncedAt: catalog.syncedAt,
  });
}
