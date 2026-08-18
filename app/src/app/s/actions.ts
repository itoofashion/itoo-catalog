"use server";

import { isTeamViewer } from "@/lib/admin/request";
import { isEmptySelection, type CatalogSelection } from "@/lib/catalog/share";
import { createShortLink } from "@/lib/links/shorten";
import { linkStore } from "@/lib/links/store";

export type NewLink = { code: string } | { error: string };

/**
 * Making a link is now a round trip to the server, because the code no longer
 * carries the selection: it is six characters the database has to agree to hand
 * out. That is the whole reason this is an action rather than a function the
 * panel calls in the browser.
 *
 * It checks the session even though the panel is only rendered for the team: an
 * action is a public endpoint like any other, and a stranger who found it could
 * otherwise write rows into the links table all day.
 */
export async function createLink(
  selection: CatalogSelection,
  /**
   * Whether the panel had the new-arrivals lens on. Compared to true rather
   * than trusted: it arrives over the wire, and anything that is not plainly
   * true must mean the plain link.
   */
  newOnly = false,
): Promise<NewLink> {
  if (!(await isTeamViewer())) return { error: "Sign in to make a link." };
  if (!isValid(selection)) return { error: "Pick something for the link first." };

  try {
    const code = await createShortLink(selection, await linkStore(), new Date(), newOnly === true);
    return { code };
  } catch {
    // The shortener only fails when it cannot find a free code, which needs the
    // table to be astronomically full. Saying so plainly beats a broken button.
    return { error: "Could not make a link just now. Try again." };
  }
}

/**
 * The argument arrives over the wire from a browser, so it is checked here
 * rather than trusted, whatever its TypeScript type promises.
 */
function isValid(selection: CatalogSelection): boolean {
  return (
    typeof selection === "object" &&
    selection !== null &&
    Array.isArray(selection.categories) &&
    Array.isArray(selection.skus) &&
    [...selection.categories, ...selection.skus].every((entry) => typeof entry === "string") &&
    !isEmptySelection(selection)
  );
}
