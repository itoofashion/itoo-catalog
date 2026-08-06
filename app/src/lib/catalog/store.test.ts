import { describe, expect, it } from "vitest";
import type { Database, PreparedStatement } from "@/lib/db/client";
import {
  catalogStore,
  createD1CatalogStore,
  createMemoryStore,
  type CatalogStore,
} from "./store";
import { seedProducts } from "./seed";
import type { Product } from "./types";

function product(sku: string, name = "Only Product"): Product {
  return {
    sku,
    name,
    price: 10,
    category: "Tops",
    colors: [],
    images: [],
    sizes: [],
    packBreakdown: null,
    minimumUnits: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    sourceId: 1,
  };
}

const replacement: Product[] = [product("NEW-1")];

type ProductRow = { generation: number; position: number; sku: string; product: string };
type StateRow = { generation: number; synced_at: string };

/**
 * Enough of D1 to run the store against: the six statements it issues, the
 * unique index on (generation, sku), and the ordering by position. The
 * migration's rules are spelled out here in TypeScript so that dropping one of
 * them shows up as a failing test rather than as a shop with two cards for one
 * style, or with its products in whatever order SQLite felt like.
 */
function fakeDatabase() {
  const products: ProductRow[] = [];
  let state: StateRow | null = null;

  const db: Database & { products: ProductRow[]; state: () => StateRow | null } = {
    products,
    state: () => state,
    prepare(query: string): PreparedStatement {
      let bound: unknown[] = [];
      const statement: PreparedStatement = {
        bind(...values) {
          bound = values;
          return statement;
        },
        async first<T>() {
          if (query.includes("MAX(generation)")) {
            const seen = [...products.map((row) => row.generation)];
            if (state) seen.push(state.generation);
            const highest = seen.length > 0 ? Math.max(...seen) : null;
            return { generation: highest } as T;
          }
          return (state as T | null) ?? null;
        },
        async all<T>() {
          const [generation] = bound as [number];
          const results = products
            .filter((row) => row.generation === generation)
            .sort((a, b) => a.position - b.position)
            .map((row) => ({ product: row.product }));
          return { results: results as T[] };
        },
        async run() {
          if (query.startsWith("DELETE")) {
            const [keep] = bound as [number];
            for (let at = products.length - 1; at >= 0; at -= 1) {
              if (products[at].generation !== keep) products.splice(at, 1);
            }
            return { meta: { changes: 1 } };
          }
          if (query.includes(`INTO catalog_state`)) {
            const [generation, syncedAt] = bound as [number, string];
            state = { generation, synced_at: syncedAt };
            return { meta: { changes: 1 } };
          }
          // The generation is written into the statement text rather than bound,
          // so it is read back out of it here.
          const generation = Number(/VALUES \((\d+),/.exec(query)?.[1]);
          for (let at = 0; at < bound.length; at += 3) {
            const row = {
              generation,
              position: bound[at] as number,
              sku: bound[at + 1] as string,
              product: bound[at + 2] as string,
            };
            const clash = products.some(
              (other) => other.generation === generation && other.sku === row.sku,
            );
            if (clash) throw new Error("UNIQUE constraint failed: catalog_products.sku");
            products.push(row);
          }
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };

  return db;
}

/**
 * Both implementations answer the same questions the same way, because every
 * page above them reads the catalog without knowing which one it got, and
 * because the memory one is what `pnpm test` and `next dev` actually run.
 */
const implementations: [string, () => CatalogStore][] = [
  ["the D1 catalog store", () => createD1CatalogStore(fakeDatabase())],
  ["the in-memory fallback", () => createMemoryStore()],
];

for (const [name, create] of implementations) {
  describe(name, () => {
    it("starts from the seed catalog so the site is never empty", async () => {
      const catalog = await create().read();
      expect(catalog.products).toHaveLength(seedProducts().length);
    });

    it("replaces the whole catalog on sync, mirroring FashionGo", async () => {
      const store = create();
      await store.replace(replacement);
      const catalog = await store.read();
      expect(catalog.products.map((p) => p.sku)).toEqual(["NEW-1"]);
    });

    it("records when the sync happened", async () => {
      const store = create();
      const before = Date.now();
      const { syncedAt } = await store.replace(replacement);
      expect(new Date(syncedAt).getTime()).toBeGreaterThanOrEqual(before);
    });

    it("keeps FashionGo's ordering", async () => {
      const store = create();
      const order = ["C-3", "A-1", "B-2"];
      await store.replace(order.map((sku) => product(sku)));
      const catalog = await store.read();
      expect(catalog.products.map((p) => p.sku)).toEqual(order);
    });

    it("keeps nothing of the catalog it replaced", async () => {
      const store = create();
      await store.replace([product("OLD-1"), product("OLD-2")]);
      await store.replace([product("NEW-1")]);
      const catalog = await store.read();
      expect(catalog.products.map((p) => p.sku)).toEqual(["NEW-1"]);
    });
  });
}

describe("the D1 catalog store", () => {
  /**
   * A sync writes eight hundred rows and cannot do it in one statement, so
   * there is a stretch of it where the table holds a whole catalog and part of
   * another. The generation number is what keeps that out of sight: a reader
   * follows the pointer, and the pointer only moves once every row has landed.
   */
  it("shows the old catalog whole until the new one is entirely written", async () => {
    const db = fakeDatabase();
    const store = createD1CatalogStore(db);
    await store.replace([product("OLD-1"), product("OLD-2")]);

    // The state a half-finished sync leaves behind: rows of a generation the
    // pointer has not been moved to yet.
    const half = createD1CatalogStore(db);
    db.products.push({
      generation: 99,
      position: 0,
      sku: "HALF-1",
      product: JSON.stringify(product("HALF-1")),
    });

    const catalog = await half.read();
    expect(catalog.products.map((p) => p.sku)).toEqual(["OLD-1", "OLD-2"]);
  });

  it("does not leave the rows of older syncs behind", async () => {
    const db = fakeDatabase();
    const store = createD1CatalogStore(db);
    await store.replace([product("OLD-1"), product("OLD-2")]);
    await store.replace([product("NEW-1")]);

    expect(db.products.map((row) => row.sku)).toEqual(["NEW-1"]);
  });

  /**
   * The catalog is read on every render. Following the pointer is one small row;
   * parsing the products behind it is eight hundred of them, and there is no
   * reason to do that twice for the same generation.
   */
  it("parses the products once per sync, not once per read", async () => {
    const db = fakeDatabase();
    const store = createD1CatalogStore(db);
    await store.replace([product("NEW-1")]);
    await store.read();

    // If the store went back for the products, this would be what it found.
    db.products.length = 0;

    const catalog = await store.read();
    expect(catalog.products.map((p) => p.sku)).toEqual(["NEW-1"]);
  });

  it("notices a sync another isolate made", async () => {
    const db = fakeDatabase();
    const reader = createD1CatalogStore(db);
    const writer = createD1CatalogStore(db);

    await writer.replace([product("FIRST")]);
    expect((await reader.read()).products.map((p) => p.sku)).toEqual(["FIRST"]);

    await writer.replace([product("SECOND")]);
    expect((await reader.read()).products.map((p) => p.sku)).toEqual(["SECOND"]);
  });

  it("refuses to store one style number twice, as the table does", async () => {
    const store = createD1CatalogStore(fakeDatabase());
    await expect(store.replace([product("SAME"), product("SAME", "Other")])).rejects.toThrow(
      /UNIQUE/,
    );
  });

  /**
   * `next dev` runs against a local D1 that a fresh checkout has never
   * migrated, and a Worker can go out a minute before its migration does. The
   * catalog has a shipped fallback for exactly this.
   */
  it("falls back to the seed when the migration has not been applied", async () => {
    const unmigrated: Database = {
      prepare() {
        throw new Error("D1_ERROR: no such table: catalog_state: SQLITE_ERROR");
      },
    };

    const catalog = await createD1CatalogStore(unmigrated).read();
    expect(catalog.products).toHaveLength(seedProducts().length);
  });

  it("lets any other database failure through rather than hiding it", async () => {
    // A shop quietly serving months-old prices is a quieter outage, not a
    // recovery: only the missing table is forgiven.
    const broken: Database = {
      prepare() {
        throw new Error("D1_ERROR: Network connection lost");
      },
    };

    await expect(createD1CatalogStore(broken).read()).rejects.toThrow(/Network/);
  });

  it("drops a row that is not a product rather than serving it", async () => {
    const db = fakeDatabase();
    const store = createD1CatalogStore(db);
    await store.replace([product("GOOD")]);
    db.products.push({
      generation: db.state()!.generation,
      position: 1,
      sku: "BROKEN",
      product: "{ not json",
    });

    // A fresh store, because the one above is holding the parsed catalog.
    const catalog = await createD1CatalogStore(db).read();
    expect(catalog.products.map((p) => p.sku)).toEqual(["GOOD"]);
  });
});

describe("the shared store", () => {
  /**
   * The page and the sync route are bundled separately, so each gets its own
   * copy of this module. Without a shared home, syncing would report success
   * while the page kept showing the old products.
   *
   * A second bundle reaches the store the same way this module does: through the
   * global registry, under a symbol looked up by name.
   */
  it("is the same catalog for every copy of this module", async () => {
    await catalogStore.replace(replacement);

    const asAnotherBundleSeesIt = (
      globalThis as typeof globalThis & Record<symbol, CatalogStore | undefined>
    )[Symbol.for("itoo.catalog.store")];

    expect(asAnotherBundleSeesIt, "store is not shared globally").toBeDefined();
    const catalog = await asAnotherBundleSeesIt!.read();
    expect(catalog.products.map((p: Product) => p.sku)).toEqual(["NEW-1"]);
  });
});
