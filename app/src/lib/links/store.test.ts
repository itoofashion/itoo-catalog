import { describe, expect, it } from "vitest";
import type { CatalogSelection } from "@/lib/catalog/share";
import type { Database, PreparedStatement } from "@/lib/db/client";
import { createD1LinkStore, createMemoryLinkStore, type LinkStore } from "./store";

const dresses: CatalogSelection = { categories: ["Dresses"], skus: [] };
const tops: CatalogSelection = { categories: ["Tops"], skus: ["Y-542"] };
const createdAt = "2026-08-04T10:00:00.000Z";

type Row = { code: string; fingerprint: string; selection: string; created_at: string };

/**
 * Enough of D1 to run the store against: the three statements it issues, and
 * the two refusals that are the entire reason the table exists. The uniqueness
 * here is the migration's, spelled out in TypeScript, so that a change to
 * either one shows up as a failing test rather than as two clients being sent
 * the same six characters.
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
          const [key] = bound as [string];
          const row = query.includes("WHERE code")
            ? rows.find((entry) => entry.code === key)
            : rows.find((entry) => entry.fingerprint === key);
          return (row as T | undefined) ?? null;
        },
        // The link store never asks for more than one row; the shape of a D1
        // statement includes it, so the stand-in has to have it too.
        async all<T>() {
          return { results: rows as unknown as T[] };
        },
        async run() {
          const [code, fingerprint, selection, created] = bound as string[];
          const refused = rows.some(
            (row) => row.code === code || row.fingerprint === fingerprint,
          );
          if (refused) return { meta: { changes: 0 } };
          rows.push({ code, fingerprint, selection, created_at: created });
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

/**
 * Both implementations answer the same questions the same way, because the
 * shortener above them cannot tell which one it got, and because the memory one
 * is what `pnpm test` and `next dev` actually run against.
 */
const implementations: [string, () => LinkStore][] = [
  ["the D1 link store", () => createD1LinkStore(fakeDatabase())],
  ["the in-memory fallback", () => createMemoryLinkStore()],
];

for (const [name, create] of implementations) {
  describe(name, () => {
    it("gives back the selection a code was stored with", async () => {
      const store = create();
      await store.insert({ code: "K7M2QP", fingerprint: "dresses", selection: dresses, createdAt });

      expect(await store.findLink("K7M2QP")).toEqual({ selection: dresses, newOnly: false });
    });

    it("keeps the new-arrivals lens a link was stored with", async () => {
      const store = create();
      await store.insert({
        code: "N1N1N1",
        fingerprint: "dresses-new",
        selection: dresses,
        createdAt,
        newOnly: true,
      });

      expect(await store.findLink("N1N1N1")).toEqual({ selection: dresses, newOnly: true });
    });

    it("knows nothing about a code that was never minted", async () => {
      expect(await create().findLink("ZZZZZZ")).toBeNull();
    });

    it("refuses a code that is already somebody else's", async () => {
      const store = create();
      await store.insert({ code: "K7M2QP", fingerprint: "dresses", selection: dresses, createdAt });

      expect(
        await store.insert({ code: "K7M2QP", fingerprint: "tops", selection: tops, createdAt }),
      ).toBe("code-taken");
      // And the first link is untouched by the attempt.
      expect(await store.findLink("K7M2QP")).toEqual({ selection: dresses, newOnly: false });
    });

    it("refuses a second code for a selection that already has one", async () => {
      const store = create();
      await store.insert({ code: "K7M2QP", fingerprint: "dresses", selection: dresses, createdAt });

      expect(
        await store.insert({
          code: "W4XN9B",
          fingerprint: "dresses",
          selection: dresses,
          createdAt,
        }),
      ).toBe("selection-stored");
      expect(await store.findLink("W4XN9B")).toBeNull();
    });

    it("finds the code a selection was already given", async () => {
      const store = create();
      await store.insert({ code: "K7M2QP", fingerprint: "dresses", selection: dresses, createdAt });

      expect(await store.findCode("dresses")).toBe("K7M2QP");
      expect(await store.findCode("tops")).toBeNull();
    });

    it("keeps hand-picked styles and whole categories apart", async () => {
      const store = create();
      await store.insert({ code: "W4XN9B", fingerprint: "tops", selection: tops, createdAt });

      expect(await store.findLink("W4XN9B")).toEqual({ selection: tops, newOnly: false });
    });
  });
}

describe("the D1 link store, on a row it should not trust", () => {
  it("treats a row that is not a selection as no link at all", async () => {
    const rows: Row[] = [
      { code: "AAAAAA", fingerprint: "a", selection: "not json", created_at: createdAt },
      { code: "BBBBBB", fingerprint: "b", selection: '{"categories":"Dresses"}', created_at: createdAt },
      { code: "CCCCCC", fingerprint: "c", selection: '{"categories":[],"skus":[]}', created_at: createdAt },
    ];
    const store = createD1LinkStore(fakeDatabase(rows));

    // The last one matters most: an empty selection would open the whole
    // catalog to whoever holds the link.
    expect(await store.findLink("AAAAAA")).toBeNull();
    expect(await store.findLink("BBBBBB")).toBeNull();
    expect(await store.findLink("CCCCCC")).toBeNull();
  });

  it("drops entries in a row that are not strings", async () => {
    const rows: Row[] = [
      {
        code: "DDDDDD",
        fingerprint: "d",
        selection: '{"categories":["Dresses",7,null],"skus":[]}',
        created_at: createdAt,
      },
    ];
    const store = createD1LinkStore(fakeDatabase(rows));

    expect(await store.findLink("DDDDDD")).toEqual({
      selection: { categories: ["Dresses"], skus: [] },
      newOnly: false,
    });
  });

  it("opens a row written before the lens existed with the lens off", async () => {
    // Every link minted before newOnly was stored looks like this row, and it
    // has to keep meaning what it meant when it was sent.
    const rows: Row[] = [
      {
        code: "EEEEEE",
        fingerprint: "e",
        selection: '{"categories":["Dresses"],"skus":[]}',
        created_at: createdAt,
      },
    ];
    const store = createD1LinkStore(fakeDatabase(rows));

    expect(await store.findLink("EEEEEE")).toEqual({
      selection: { categories: ["Dresses"], skus: [] },
      newOnly: false,
    });
  });

  it("reads the lens back only when the row plainly says true", async () => {
    const rows: Row[] = [
      {
        code: "FFFFFF",
        fingerprint: "f",
        selection: '{"categories":["Dresses"],"skus":[],"newOnly":true}',
        created_at: createdAt,
      },
      {
        code: "GGGGGG",
        fingerprint: "g",
        selection: '{"categories":["Dresses"],"skus":[],"newOnly":"yes"}',
        created_at: createdAt,
      },
    ];
    const store = createD1LinkStore(fakeDatabase(rows));

    expect(await store.findLink("FFFFFF")).toEqual({
      selection: { categories: ["Dresses"], skus: [] },
      newOnly: true,
    });
    // A hand-typed row must not smuggle a truthy string in as the lens.
    expect(await store.findLink("GGGGGG")).toEqual({
      selection: { categories: ["Dresses"], skus: [] },
      newOnly: false,
    });
  });

  it("counts a write that landed even when no row count comes back", async () => {
    // D1 reports how many rows changed, but a link that was written and then
    // called a collision would send the caller off drawing codes until it gave
    // up. The fingerprint is asked instead of the row count being trusted.
    const quiet = fakeDatabase();
    const silent: Database = {
      prepare(query) {
        const inner = quiet.prepare(query);
        const statement: PreparedStatement = {
          bind(...values) {
            inner.bind(...values);
            return statement;
          },
          first<T>() {
            return inner.first<T>();
          },
          all<T>() {
            return inner.all<T>();
          },
          async run() {
            await inner.run();
            return { meta: {} };
          },
        };
        return statement;
      },
    };
    const store = createD1LinkStore(silent);

    expect(
      await store.insert({ code: "K7M2QP", fingerprint: "dresses", selection: dresses, createdAt }),
    ).toBe("stored");
  });

  it("writes the selection, the fingerprint and the time it was made", async () => {
    const database = fakeDatabase();
    const store = createD1LinkStore(database);
    await store.insert({ code: "K7M2QP", fingerprint: "dresses", selection: dresses, createdAt });

    expect(database.rows).toEqual([
      {
        code: "K7M2QP",
        fingerprint: "dresses",
        selection: '{"categories":["Dresses"],"skus":[]}',
        created_at: createdAt,
      },
    ]);
  });
});
