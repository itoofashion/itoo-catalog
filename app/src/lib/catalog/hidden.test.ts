import { describe, expect, it } from "vitest";
import type { Database, PreparedStatement } from "@/lib/db/client";
import {
  createD1HiddenStyles,
  createMemoryHiddenStyles,
  type HiddenStyles,
} from "./hidden";

const at = "2026-08-04T10:00:00.000Z";

type Row = { sku: string; hidden_at: string };

/**
 * Enough of D1 to run the store against: the three statements it issues, and
 * the primary key that makes hiding idempotent. The uniqueness here is the
 * migration's, spelled out in TypeScript, so that dropping it from the table
 * shows up as a failing test rather than as an error thrown at a sales person
 * who pressed the eye twice.
 */
function fakeDatabase(rows: Row[] = []): Database & { rows: Row[] } {
  return {
    rows,
    prepare(query: string): PreparedStatement {
      let bound: unknown[] = [];
      const statement: PreparedStatement = {
        bind(...values) {
          bound = values;
          return statement;
        },
        async first<T>() {
          return null as T | null;
        },
        async all<T>() {
          return { results: rows as unknown as T[] };
        },
        async run() {
          const [sku, hiddenAt] = bound as string[];
          if (query.startsWith("DELETE")) {
            const at = rows.findIndex((row) => row.sku === sku);
            if (at >= 0) rows.splice(at, 1);
            return { meta: { changes: at >= 0 ? 1 : 0 } };
          }
          // INSERT OR IGNORE against the primary key: a second write of the
          // same style number is swallowed, not an error and not a second row.
          if (rows.some((row) => row.sku === sku)) return { meta: { changes: 0 } };
          rows.push({ sku, hidden_at: hiddenAt });
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

/**
 * Both implementations answer the same way, because the catalog above them
 * cannot tell which one it got, and because the memory one is what `pnpm test`
 * and `next dev` actually run against.
 */
const implementations: [string, () => HiddenStyles][] = [
  ["the D1 hidden styles", () => createD1HiddenStyles(fakeDatabase())],
  ["the in-memory fallback", () => createMemoryHiddenStyles()],
];

for (const [name, create] of implementations) {
  describe(name, () => {
    it("starts with nothing hidden", async () => {
      expect(await create().list()).toEqual(new Set());
    });

    it("remembers a style that was hidden", async () => {
      const store = create();
      await store.hide("Y-542", at);

      expect(await store.list()).toEqual(new Set(["Y-542"]));
    });

    it("keeps hidden styles apart from each other", async () => {
      const store = create();
      await store.hide("Y-542", at);
      await store.hide("WP-2160", at);
      await store.show("Y-542");

      expect(await store.list()).toEqual(new Set(["WP-2160"]));
    });

    it("hides a style twice without failing and without hiding it twice", async () => {
      // Two presses on a slow connection, or two people at once. Neither is an
      // error, and the second must not undo or duplicate the first.
      const store = create();
      await store.hide("Y-542", at);
      await store.hide("Y-542", "2026-08-05T10:00:00.000Z");

      expect(await store.list()).toEqual(new Set(["Y-542"]));
    });

    it("brings a style back twice without failing", async () => {
      const store = create();
      await store.hide("Y-542", at);
      await store.show("Y-542");
      await store.show("Y-542");

      expect(await store.list()).toEqual(new Set());
    });

    it("brings back a style that was never hidden", async () => {
      const store = create();
      await store.show("NEVER-1");

      expect(await store.list()).toEqual(new Set());
    });

    it("hides a style again after it was brought back", async () => {
      const store = create();
      await store.hide("Y-542", at);
      await store.show("Y-542");
      await store.hide("Y-542", at);

      expect(await store.list()).toEqual(new Set(["Y-542"]));
    });
  });
}

describe("the D1 hidden styles, in the table", () => {
  it("writes the style number and when it was hidden", async () => {
    const database = fakeDatabase();
    await createD1HiddenStyles(database).hide("Y-542", at);

    expect(database.rows).toEqual([{ sku: "Y-542", hidden_at: at }]);
  });

  it("leaves the table empty after the style is brought back", async () => {
    const database = fakeDatabase();
    const store = createD1HiddenStyles(database);
    await store.hide("Y-542", at);
    await store.show("Y-542");

    expect(database.rows).toEqual([]);
  });

  it("ignores a row that is not a style number", async () => {
    // Rows can be written by hand in the D1 console, and one that is not a
    // string must not become a style number the catalog then tries to match.
    const rows = [
      { sku: "Y-542", hidden_at: at },
      { sku: 7, hidden_at: at },
      { sku: "", hidden_at: at },
    ] as unknown as Row[];

    expect(await createD1HiddenStyles(fakeDatabase(rows)).list()).toEqual(
      new Set(["Y-542"]),
    );
  });

  it("copes with D1 answering without a results array", async () => {
    const empty: Database = {
      prepare() {
        const statement: PreparedStatement = {
          bind: () => statement,
          async first<T>() {
            return null as T | null;
          },
          async all() {
            return {};
          },
          async run() {
            return { meta: { changes: 0 } };
          },
        };
        return statement;
      },
    };

    expect(await createD1HiddenStyles(empty).list()).toEqual(new Set());
  });
});

describe("the in-memory fallback, on its own terms", () => {
  it("does not let a caller change the store by holding its answer", async () => {
    const store = createMemoryHiddenStyles();
    await store.hide("Y-542", at);

    const list = await store.list();
    list.add("WP-2160");

    expect(await store.list()).toEqual(new Set(["Y-542"]));
  });
});
