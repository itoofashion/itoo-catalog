import { NextResponse } from "next/server";
import { linkStore } from "@/lib/links/store";
import { parseSelection } from "@/lib/links/parse";

/**
 * Trades a selection for a short code, so what lands in a client's chat is
 * itoo.example/s/k3f9qa rather than a query string. Anyone can create one: a
 * link only ever points at products that are already public, and the codes are
 * for tidiness, not for access control.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const selection = parseSelection(body);
  if (!selection) {
    return NextResponse.json({ error: "Expected a selection" }, { status: 400 });
  }

  return NextResponse.json({ code: await linkStore.create(selection) });
}
