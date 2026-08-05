import { isEmptySelection, type CatalogSelection } from "@/lib/catalog/share";
import { CODE_LENGTH, isShortCode, randomCode } from "./code";
import { fingerprintSelection } from "./fingerprint";
import { decodeLegacyCode } from "./legacy";
import type { LinkStore } from "./store";

/**
 * Minting a link, and opening one.
 *
 * Minting is: does this selection already have a code, and if not, draw one and
 * try to write it. The draw-and-write is a loop because two isolates can draw
 * the same six characters at the same moment; the database refuses the second
 * one and the loop simply draws again. That is the whole collision strategy,
 * and it is enough while the table is nowhere near filling 30^6 codes.
 */

/**
 * A code has to be handed to a sales person who is waiting on a button, so the
 * loop is bounded. Five draws at one length, then a character longer: an
 * exhausted length means the table has grown past what six characters can hold
 * comfortably, and a seven-character link is a far better answer than an error
 * on a button press. Reaching even the first extra character takes a table with
 * millions of rows in it.
 */
const DRAWS_PER_LENGTH = 5;
const MAX_DRAWS = 25;

export async function createShortLink(
  selection: CatalogSelection,
  store: LinkStore,
  now: Date = new Date(),
): Promise<string> {
  if (isEmptySelection(selection)) {
    throw new Error("A short link needs something selected.");
  }

  const fingerprint = fingerprintSelection(selection);

  // The button gets pressed again on the same selection all the time, by the
  // same person wanting the link a second time. That must not mint a second
  // code, or the table fills with rows that all mean one thing.
  const existing = await store.findCode(fingerprint);
  if (existing) return existing;

  const createdAt = now.toISOString();
  for (let draw = 0; draw < MAX_DRAWS; draw += 1) {
    const code = randomCode(CODE_LENGTH + Math.floor(draw / DRAWS_PER_LENGTH));
    const outcome = await store.insert({ code, fingerprint, selection, createdAt });

    if (outcome === "stored") return code;
    if (outcome === "selection-stored") {
      // Somebody else minted this exact selection between the lookup above and
      // this write. Their code is as good as the one just drawn, and the point
      // is that both people end up sending the same link.
      const theirs = await store.findCode(fingerprint);
      if (theirs) return theirs;
    }
    // "code-taken": those six characters are somebody else's. Draw again.
  }

  throw new Error("Could not find a free short link code.");
}

/**
 * The other direction, on every visit to /s/<code>.
 *
 * The database is asked first because that is where every link minted from now
 * on lives. Only if it has never heard of the code is it handed to the old
 * self-describing decoder, which is how links sent before there was a database
 * keep opening (see legacy.ts). Null here means 404: an unknown code is a
 * broken link, and showing the whole catalog instead would send a client
 * everything, which is exactly what a selection link exists to avoid.
 */
export async function resolveShortLink(
  code: string,
  store: LinkStore,
): Promise<CatalogSelection | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  try {
    for (const candidate of candidates(trimmed)) {
      const selection = await store.findSelection(candidate);
      if (selection) return selection;
    }
  } catch {
    // A database that is unreachable, or a table not yet migrated, must not
    // take the old self-decoding links down with it: those are in people's
    // chats and need nothing looked up. New codes 404 until it comes back,
    // which is the same answer the visitor would get from a 500 but without
    // the site looking broken.
  }

  return decodeLegacyCode(trimmed);
}

/**
 * Codes are minted in one case, so a code read out over the phone and typed in
 * lowercase is still that code. The exact spelling is tried first, because the
 * old long codes are case-sensitive and must not be disturbed, and the upper
 * case retry only happens for something shaped like a short code.
 */
function candidates(code: string): string[] {
  const upper = code.toUpperCase();
  if (upper === code || !isShortCode(upper)) return [code];
  return [code, upper];
}
