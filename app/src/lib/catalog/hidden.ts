import { database, type Database } from "@/lib/db/client";

/**
 * Which styles the team has taken out of the catalog.
 *
 * A sold-out style is still a style in FashionGo, and a sync replaces the whole
 * catalog with whatever FashionGo says, so this decision cannot live on the
 * product: the next sync would erase it. It lives beside the catalog instead,
 * as a list of style numbers, in D1 for the same reason short links are there.
 * The catalog itself is memory in a Worker isolate, and an isolate is recycled
 * without warning. A style that came back from the dead in front of a client
 * because Cloudflare moved the request is the one failure this must not have.
 *
 * Both writes are idempotent by construction rather than by checking first:
 * hiding is INSERT OR IGNORE against the primary key, showing is a DELETE that
 * matches nothing. Pressing the eye twice, or two people pressing it at once,
 * is a thing that happens on a slow connection and must not be an error.
 *
 * The memory implementation is not a toy: `next dev` and `pnpm test` have no D1
 * underneath them, and the button working there is worth more than the list
 * outliving a restart on a laptop. See lib/links/store.ts, which is the same
 * arrangement for the same reason.
 */
export interface HiddenStyles {
  /** Every hidden style number. A set, because every caller asks "is this one?". */
  list(): Promise<Set<string>>;
  /** Takes a style out of the catalog. Doing it twice is doing it once. */
  hide(sku: string, at: string): Promise<void>;
  /** Puts it back. Showing a style that was never hidden is not an error. */
  show(sku: string): Promise<void>;
}

const TABLE = "hidden_styles";

export function createD1HiddenStyles(db: Database): HiddenStyles {
  return {
    async list() {
      const answer = await db.prepare(`SELECT sku FROM ${TABLE}`).all<{ sku: unknown }>();
      const rows = answer.results ?? [];
      // Checked rather than trusted on the way out, the way a stored selection
      // is: a row written by hand in the D1 console must not be able to put a
      // number where the catalog expects a style.
      return new Set(
        rows
          .map((row) => row.sku)
          .filter((sku): sku is string => typeof sku === "string" && sku !== ""),
      );
    },

    async hide(sku, at) {
      await db
        .prepare(`INSERT OR IGNORE INTO ${TABLE} (sku, hidden_at) VALUES (?1, ?2)`)
        .bind(sku, at)
        .run();
    },

    async show(sku) {
      await db.prepare(`DELETE FROM ${TABLE} WHERE sku = ?1`).bind(sku).run();
    },
  };
}

export function createMemoryHiddenStyles(): HiddenStyles {
  const hidden = new Set<string>();

  return {
    async list() {
      // Copied on the way out, so a caller holding the answer cannot change
      // what the store thinks, which is a difference the D1 one would not have.
      return new Set(hidden);
    },
    async hide(sku) {
      hidden.add(sku);
    },
    async show(sku) {
      hidden.delete(sku);
    },
  };
}

/**
 * Held on globalThis rather than in a module variable, for the reason the link
 * store is: the catalog page and the action that hides a style are bundled
 * separately, so a plain module-level set would give each of them its own copy
 * and a style hidden by the button would still be on the page.
 */
const STORE_KEY = Symbol.for("itoo.catalog.hidden");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: HiddenStyles };

function sharedMemoryStore(): HiddenStyles {
  const container = globalThis as GlobalWithStore;
  container[STORE_KEY] ??= createMemoryHiddenStyles();
  return container[STORE_KEY];
}

export async function hiddenStyles(): Promise<HiddenStyles> {
  const db = await database();
  return db ? createD1HiddenStyles(db) : sharedMemoryStore();
}
