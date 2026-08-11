import { database, type Database } from "@/lib/db/client";

/**
 * Whether a sync has been asked for, and what the last one did.
 *
 * The "Sync now" button cannot run a sync: FashionGo answers a whitelisted
 * address, and a Worker has no fixed one (see lib/fashiongo/sync-request.ts).
 * So the button leaves a note, and a puller on a machine FashionGo knows polls
 * for the note every minute. This is that note, one row in D1: when the team
 * last asked, and when a sync last landed with how many styles.
 *
 * A completed sync answers every request before it. Deliberately including one
 * made while it was running: the puller read FashionGo seconds earlier, and a
 * second run straight after would push the same catalog again.
 *
 * The memory implementation is not a toy: `next dev` and `pnpm test` have no D1
 * underneath them, and the button working there is worth more than a request
 * surviving a restart on a laptop. See lib/catalog/hidden.ts, which is the same
 * arrangement for the same reason.
 */
export type SyncRun = {
  /** ISO 8601, the moment the sync's push landed. */
  finishedAt: string;
  /** How many styles the catalog held afterwards. */
  styleCount: number;
};

export type SyncStatus = {
  /** When the team last asked and has not been answered, or null. */
  requestedAt: string | null;
  lastRun: SyncRun | null;
};

export interface SyncState {
  read(): Promise<SyncStatus>;
  /** The team asking. Asking again only moves the timestamp. */
  request(at: string): Promise<void>;
  /** A sync landed: remember it, and consider every request before it answered. */
  complete(run: SyncRun): Promise<void>;
}

const TABLE = "sync_state";

type StateRow = {
  requested_at: unknown;
  finished_at: unknown;
  style_count: unknown;
};

export function createD1SyncState(db: Database): SyncState {
  return {
    async read() {
      let row: StateRow | null;
      try {
        row = await db
          .prepare(`SELECT requested_at, finished_at, style_count FROM ${TABLE} WHERE id = 1`)
          .first<StateRow>();
      } catch (error) {
        // A Worker can be deployed a minute before the migration lands, and the
        // admin panel opening in that minute should say "never synced", not
        // crash. Only this one refusal is caught; see lib/catalog/store.ts.
        if (isMissingTable(error)) return { requestedAt: null, lastRun: null };
        throw error;
      }

      // Checked rather than trusted on the way out: a row written by hand in
      // the D1 console must not hand the panel something that is not a status.
      const requestedAt = typeof row?.requested_at === "string" ? row.requested_at : null;
      const lastRun =
        typeof row?.finished_at === "string" && typeof row.style_count === "number"
          ? { finishedAt: row.finished_at, styleCount: row.style_count }
          : null;
      return { requestedAt, lastRun };
    },

    async request(at) {
      await db
        .prepare(
          `INSERT INTO ${TABLE} (id, requested_at) VALUES (1, ?1)
           ON CONFLICT(id) DO UPDATE SET requested_at = excluded.requested_at`,
        )
        .bind(at)
        .run();
    },

    async complete(run) {
      await db
        .prepare(
          `INSERT INTO ${TABLE} (id, requested_at, finished_at, style_count)
           VALUES (1, NULL, ?1, ?2)
           ON CONFLICT(id) DO UPDATE SET finished_at = excluded.finished_at,
                                         style_count = excluded.style_count,
                                         requested_at = NULL`,
        )
        .bind(run.finishedAt, run.styleCount)
        .run();
    },
  };
}

export function createMemorySyncState(): SyncState {
  let status: SyncStatus = { requestedAt: null, lastRun: null };

  return {
    async read() {
      // Copied on the way out, so a caller holding the answer cannot change
      // what the store thinks; the D1 one would not have that difference.
      return { requestedAt: status.requestedAt, lastRun: status.lastRun && { ...status.lastRun } };
    },
    async request(at) {
      status = { ...status, requestedAt: at };
    },
    async complete(run) {
      status = { requestedAt: null, lastRun: { ...run } };
    },
  };
}

function isMissingTable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  const said = `${error.message} ${cause instanceof Error ? cause.message : ""}`;
  return /no such table/i.test(said);
}

/**
 * Held on globalThis rather than in a module variable, for the reason the
 * hidden-styles store is: the admin page, the action behind the button and the
 * sync route are bundled separately, so a plain module-level store would give
 * each of them its own copy, and a request recorded by the button would never
 * be seen by the endpoint the puller polls.
 */
const STORE_KEY = Symbol.for("itoo.sync.state");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: SyncState };

function sharedMemoryStore(): SyncState {
  const container = globalThis as GlobalWithStore;
  container[STORE_KEY] ??= createMemorySyncState();
  return container[STORE_KEY];
}

export async function syncState(): Promise<SyncState> {
  const db = await database();
  return db ? createD1SyncState(db) : sharedMemoryStore();
}
