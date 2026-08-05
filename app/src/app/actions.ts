"use server";

import { isTeamViewer } from "@/lib/admin/request";
import { hiddenStyles } from "@/lib/catalog/hidden";

export type HideResult = { ok: true } | { error: string };

/** A style number is short; anything longer is not one, whatever it claims. */
const MAX_SKU_LENGTH = 64;

/**
 * The eye on a card, from the server's side.
 *
 * It checks the session even though the eye is only drawn for the team, for the
 * same reason createLink does: a Server Action is a public endpoint that anyone
 * who reads the page's JavaScript can find, and a control being invisible is not
 * a control being guarded. Without this check a stranger could empty the catalog
 * one style at a time.
 *
 * Both directions are idempotent in the store below, so a second press while the
 * first is still in the air is not an error and does not need to be reported as
 * one. See lib/catalog/hidden.ts.
 */
export async function setStyleHidden(sku: string, hidden: boolean): Promise<HideResult> {
  if (!(await isTeamViewer())) return { error: "Sign in to change the catalog." };
  if (!isStyleNumber(sku)) return { error: "That is not a style." };

  try {
    const styles = await hiddenStyles();
    if (hidden) await styles.hide(sku, new Date().toISOString());
    else await styles.show(sku);
    return { ok: true };
  } catch {
    // The card puts itself back the way it was when this comes through, so the
    // team sees the catalog as it really is rather than as the press meant it.
    return { error: "Could not save that just now. Try again." };
  }
}

/**
 * The argument arrives over the wire from a browser, so it is checked here
 * rather than trusted, whatever its TypeScript type promises.
 */
function isStyleNumber(sku: unknown): sku is string {
  return typeof sku === "string" && sku.trim() !== "" && sku.length <= MAX_SKU_LENGTH;
}
