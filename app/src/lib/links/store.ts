import type { CatalogSelection } from "@/lib/catalog/share";
import { database, type Database } from "@/lib/db/client";

/**
 * Where a short link's meaning is kept.
 *
 * The whole reason this exists: a code is six characters and says nothing, so
 * something has to remember that XK4M2P means "all of Dresses plus these two
 * styles". On Cloudflare that is the D1 database bound as DB.
 *
 * Two rules the interface exists to keep, both enforced by the database rather
 * than by a check in front of it, because a Worker runs in many isolates at
 * once and any "look first, write second" leaves a window between the two:
 *
 *   - a code is never handed out twice (the primary key),
 *   - one selection has one code (the unique index on the fingerprint).
 *
 * The memory implementation is not a toy: `next dev` and the test run have no
 * D1 underneath them, and the site working there is worth more than links
 * surviving a restart on a laptop. It mirrors the same two refusals so the
 * shortener above it is exercised the same way in both.
 */
export interface LinkStore {
  /** What a code points at, or null if it was never minted. */
  findLink(code: string): Promise<SharedLink | null>;
  /** The code already minted for this selection, if there is one. */
  findCode(fingerprint: string): Promise<string | null>;
  /** Writes a link, or reports which of the two rules refused it. */
  insert(link: StoredLink): Promise<InsertOutcome>;
}

/**
 * What a code means when it is opened: the selection, and whether the link was
 * made with the new-arrivals lens on. The lens travels with the link because
 * the panel promised the client the new arrivals, not the whole categories.
 */
export type SharedLink = {
  selection: CatalogSelection;
  newOnly: boolean;
};

export type StoredLink = {
  code: string;
  fingerprint: string;
  selection: CatalogSelection;
  createdAt: string;
  /** Absent means off: every link minted before the lens existed reads false. */
  newOnly?: boolean;
};

export type InsertOutcome =
  /** Written. The code is now this selection's, forever. */
  | "stored"
  /** That code is somebody else's already; draw another and try again. */
  | "code-taken"
  /** This selection already has a code, minted by whoever got here first. */
  | "selection-stored";

const TABLE = "short_links";

export function createD1LinkStore(db: Database): LinkStore {
  async function findCode(fingerprint: string): Promise<string | null> {
    const row = await db
      .prepare(`SELECT code FROM ${TABLE} WHERE fingerprint = ?1`)
      .bind(fingerprint)
      .first<{ code: string }>();
    return row?.code ?? null;
  }

  return {
    async findLink(code) {
      const row = await db
        .prepare(`SELECT selection FROM ${TABLE} WHERE code = ?1`)
        .bind(code)
        .first<{ selection: string }>();
      return row ? parseStoredLink(row.selection) : null;
    },

    findCode,

    async insert(link) {
      // INSERT OR IGNORE rather than a SELECT beforehand: this is the one moment
      // uniqueness actually matters, and only the database can decide it without
      // a gap. A row count of zero means one of the two indexes said no, and the
      // fingerprint is what tells them apart.
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO ${TABLE} (code, fingerprint, selection, created_at)
           VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(
          link.code,
          link.fingerprint,
          // The lens rides inside the selection column: it is part of what the
          // code means, and a column migration for one boolean would be more
          // machinery than the meaning needs.
          JSON.stringify(
            link.newOnly ? { ...link.selection, newOnly: true } : link.selection,
          ),
          link.createdAt,
        )
        .run();

      if (result.meta?.changes === 1) return "stored";

      // Nothing was written, or D1 did not say how much was. Either way the
      // fingerprint settles it, and asking beats trusting a row count: reading
      // back our own code means the write did land after all, and reading back
      // somebody else's means they minted this selection first.
      const owner = await findCode(link.fingerprint);
      if (owner === link.code) return "stored";
      return owner ? "selection-stored" : "code-taken";
    },
  };
}

export function createMemoryLinkStore(): LinkStore {
  const byCode = new Map<string, StoredLink>();
  const byFingerprint = new Map<string, string>();

  return {
    async findLink(code) {
      const link = byCode.get(code);
      return link ? { selection: link.selection, newOnly: link.newOnly === true } : null;
    },
    async findCode(fingerprint) {
      return byFingerprint.get(fingerprint) ?? null;
    },
    async insert(link) {
      if (byFingerprint.has(link.fingerprint)) return "selection-stored";
      if (byCode.has(link.code)) return "code-taken";
      byCode.set(link.code, link);
      byFingerprint.set(link.fingerprint, link.code);
      return "stored";
    },
  };
}

/**
 * A stored selection is text that came out of a database, so it is checked on
 * the way back in rather than trusted: a row written by an older version of
 * this code, or by hand in the D1 console, must not be able to hand the catalog
 * something that is not a selection.
 */
function parseStoredLink(value: string): SharedLink | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { categories, skus, newOnly } = parsed as Record<string, unknown>;
    const selection = { categories: strings(categories), skus: strings(skus) };
    // An empty selection is a broken row, not an invitation to show everything.
    if (selection.categories.length === 0 && selection.skus.length === 0) return null;
    // Strictly true, never truthy: a hand-typed row must not smuggle a string
    // in as the lens. A row from before the lens existed has nothing here and
    // reads false, which is what its link meant when it was sent.
    return { selection, newOnly: newOnly === true };
  } catch {
    return null;
  }
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry !== "");
}

/**
 * Held on globalThis rather than in a module variable, for the reason the image
 * store is: the page and the link action are bundled separately, so a plain
 * module-level map would give each of them its own copy and a link made in one
 * would not open in the other.
 */
const STORE_KEY = Symbol.for("itoo.links.store");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: LinkStore };

function sharedMemoryStore(): LinkStore {
  const container = globalThis as GlobalWithStore;
  container[STORE_KEY] ??= createMemoryLinkStore();
  return container[STORE_KEY];
}

export async function linkStore(): Promise<LinkStore> {
  const db = await database();
  return db ? createD1LinkStore(db) : sharedMemoryStore();
}
