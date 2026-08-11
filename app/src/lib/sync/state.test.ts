import { describe, expect, it } from "vitest";
import type { Database, PreparedStatement } from "@/lib/db/client";
import {
  createD1SyncState,
  createMemorySyncState,
  type SyncState,
} from "./state";

const asked = "2026-08-11T08:00:00.000Z";
const landed = "2026-08-11T08:05:00.000Z";

type Row = {
  requested_at: string | null;
  finished_at: string | null;
  style_count: number | null;
};

/**
 * Enough of D1 to run the store against: one row, upserted. The single-row
 * shape is the migration's promise (id = 1), spelled out here so the store's
 * three statements can be exercised without a database.
 */
function fakeDatabase(initial: Row | null = null): Database & { row: () => Row | null } {
  let row = initial;
  return {
    row: () => row,
    prepare(query: string): PreparedStatement {
      let bound: unknown[] = [];
      const statement: PreparedStatement = {
        bind(...values) {
          bound = values;
          return statement;
        },
        async first<T>() {
          if (query.includes("no_such_table")) throw new Error("no such table: sync_state");
          return row as T | null;
        },
        async all<T>() {
          return { results: [] as T[] };
        },
        async run() {
          if (query.includes("requested_at = excluded.requested_at")) {
            row = {
              requested_at: bound[0] as string,
              finished_at: row?.finished_at ?? null,
              style_count: row?.style_count ?? null,
            };
          } else {
            row = {
              requested_at: null,
              finished_at: bound[0] as string,
              style_count: bound[1] as number,
            };
          }
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

/**
 * Both implementations answer the same way: the memory one is what `next dev`
 * and the test run actually exercise, so it is held to the D1 one's contract.
 */
const implementations: [string, () => SyncState][] = [
  ["the D1 sync state", () => createD1SyncState(fakeDatabase())],
  ["the in-memory fallback", () => createMemorySyncState()],
];

for (const [name, create] of implementations) {
  describe(name, () => {
    it("starts with nothing asked and nothing run", async () => {
      expect(await create().read()).toEqual({ requestedAt: null, lastRun: null });
    });

    it("remembers that a sync was asked for", async () => {
      const state = create();
      await state.request(asked);

      expect((await state.read()).requestedAt).toBe(asked);
    });

    it("only moves the timestamp when the button is pressed again", async () => {
      const state = create();
      await state.request(asked);
      await state.request(landed);

      expect((await state.read()).requestedAt).toBe(landed);
    });

    it("records a completed run", async () => {
      const state = create();
      await state.complete({ finishedAt: landed, styleCount: 737 });

      expect((await state.read()).lastRun).toEqual({
        finishedAt: landed,
        styleCount: 737,
      });
    });

    it("considers a pending request answered by the run that follows it", async () => {
      const state = create();
      await state.request(asked);
      await state.complete({ finishedAt: landed, styleCount: 737 });

      const status = await state.read();
      expect(status.requestedAt).toBeNull();
      expect(status.lastRun).toEqual({ finishedAt: landed, styleCount: 737 });
    });

    it("keeps the last run when a new request comes in", async () => {
      const state = create();
      await state.complete({ finishedAt: landed, styleCount: 737 });
      await state.request(asked);

      const status = await state.read();
      expect(status.requestedAt).toBe(asked);
      expect(status.lastRun).toEqual({ finishedAt: landed, styleCount: 737 });
    });

    it("remembers only the newest run", async () => {
      const state = create();
      await state.complete({ finishedAt: asked, styleCount: 700 });
      await state.complete({ finishedAt: landed, styleCount: 737 });

      expect((await state.read()).lastRun).toEqual({
        finishedAt: landed,
        styleCount: 737,
      });
    });
  });
}

describe("the D1 sync state, against what the table may hold", () => {
  it("reads a row an earlier deploy left half-filled", async () => {
    const state = createD1SyncState(
      fakeDatabase({ requested_at: asked, finished_at: null, style_count: null }),
    );

    expect(await state.read()).toEqual({ requestedAt: asked, lastRun: null });
  });

  it("ignores a row that holds the wrong kinds of thing", async () => {
    const state = createD1SyncState(
      fakeDatabase({
        requested_at: 7,
        finished_at: landed,
        style_count: "many",
      } as unknown as Row),
    );

    expect(await state.read()).toEqual({ requestedAt: null, lastRun: null });
  });

  it("answers empty rather than failing while the table is not there yet", async () => {
    // A Worker can be deployed a minute before the migration lands; the admin
    // panel opening in that minute should say "never synced", not crash.
    const missing: Database = {
      prepare() {
        const statement: PreparedStatement = {
          bind: () => statement,
          async first(): Promise<never> {
            throw new Error("no such table: sync_state");
          },
          async all() {
            return {};
          },
          async run() {
            return {};
          },
        };
        return statement;
      },
    };

    expect(await createD1SyncState(missing).read()).toEqual({
      requestedAt: null,
      lastRun: null,
    });
  });
});
