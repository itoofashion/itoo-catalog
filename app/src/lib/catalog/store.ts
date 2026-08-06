import { database, type Database } from "@/lib/db/client";
import { seedCatalog } from "./seed";
import type { Catalog, Product } from "./types";

/**
 * Where the live catalog lives.
 *
 * Sync is a full replacement: whatever is pushed becomes the catalog, exactly
 * as it stands in FashionGo. There is no merge or conflict handling by
 * design: FashionGo is the source of truth.
 *
 * On Cloudflare that is the D1 database bound as DB. The memory implementation
 * is not a toy: `next dev` and the test run have no D1 underneath them, and the
 * site working there is worth more than a sync surviving a restart on a laptop.
 * See lib/links/store.ts, which is the same arrangement for the same reason.
 *
 * Either way the shipped seed is the answer while the table is empty, so a
 * fresh deployment shows a shop rather than an empty page.
 */
export interface CatalogStore {
  read(): Promise<Catalog>;
  replace(products: Product[]): Promise<Catalog>;
}

export function createMemoryStore(initial: Catalog = seedCatalog()): CatalogStore {
  let catalog = initial;
  return {
    async read() {
      return catalog;
    },
    async replace(products) {
      catalog = { products, syncedAt: new Date().toISOString() };
      return catalog;
    },
  };
}

const PRODUCTS = "catalog_products";
const STATE = "catalog_state";

/**
 * How many products go into one INSERT.
 *
 * D1 takes at most a hundred bound values per statement, and a row costs three
 * of them, so this is the largest round number that fits with room to spare.
 * Eight hundred products land in around thirty statements, run one after
 * another: they are writes to a generation nothing is reading yet, so there is
 * nothing to gain from making them atomic together, and the one write that has
 * to be atomic is the single row that follows them.
 */
const CHUNK = 25;

type StateRow = { generation: number; synced_at: string };

/**
 * The shipped catalog, built once.
 *
 * Building it maps eight hundred raw FashionGo records, and until the first
 * sync lands it is the answer to every read there is, so an isolate serving a
 * fresh deployment would otherwise do that work on every page it draws. The
 * memory store already hands out one instance over and over, so sharing one
 * here is the arrangement that was already in place, not a new promise.
 */
let shippedCatalog: Catalog | null = null;

function seed(): Catalog {
  shippedCatalog ??= seedCatalog();
  return shippedCatalog;
}

export function createD1CatalogStore(db: Database): CatalogStore {
  /**
   * The parsed catalog, kept for as long as the generation it was parsed from
   * is still the current one.
   *
   * The catalog is read on every render, and parsing eight hundred products out
   * of JSON on every one of them is work a page has no reason to repeat: the
   * catalog only changes when a sync says so, and a sync says so by changing the
   * generation number. So a read asks the database for the pointer, which is one
   * row, and stops there whenever the answer is the generation already in hand.
   */
  let held: { generation: number; catalog: Catalog } | null = null;

  function cache(generation: number, catalog: Catalog): Catalog {
    held = { generation, catalog };
    return catalog;
  }

  async function state(): Promise<StateRow | null> {
    const row = await db
      .prepare(`SELECT generation, synced_at FROM ${STATE} WHERE id = 1`)
      .first<StateRow>();
    return typeof row?.generation === "number" && typeof row.synced_at === "string"
      ? row
      : null;
  }

  async function productsOf(generation: number): Promise<Product[]> {
    const answer = await db
      .prepare(`SELECT product FROM ${PRODUCTS} WHERE generation = ?1 ORDER BY position`)
      .bind(generation)
      .all<{ product: unknown }>();
    return (answer.results ?? [])
      .map((row) => parseProduct(row.product))
      .filter((product): product is Product => product !== null);
  }

  return {
    async read() {
      let pointer: StateRow | null;
      try {
        pointer = await state();
      } catch (error) {
        if (!isMissingTable(error)) throw error;
        return seed();
      }
      // No pointer means no sync has ever landed. The shop opens on the seed.
      if (!pointer) return seed();

      if (held?.generation === pointer.generation) return held.catalog;

      let products = await productsOf(pointer.generation);

      // Empty is either a database that has never been synced or, far less
      // likely, a sync that swapped and cleaned up between the two statements
      // above. Asking once more tells the two apart, and costs one small query
      // in a case that hardly ever happens.
      if (products.length === 0) {
        const now = await state();
        if (!now || now.generation === pointer.generation) return seed();
        products = await productsOf(now.generation);
        if (products.length === 0) return seed();
        return cache(now.generation, { products, syncedAt: now.synced_at });
      }

      return cache(pointer.generation, { products, syncedAt: pointer.synced_at });
    },

    async replace(products) {
      const next = (await highestGeneration(db)) + 1;

      for (let at = 0; at < products.length; at += CHUNK) {
        const chunk = products.slice(at, at + CHUNK);
        // The generation is a number this code just computed, so it goes into
        // the statement text; only data that came off the network is bound.
        const values = chunk
          .map((_, index) => `(${next}, ?${index * 3 + 1}, ?${index * 3 + 2}, ?${index * 3 + 3})`)
          .join(", ");
        await db
          .prepare(`INSERT INTO ${PRODUCTS} (generation, position, sku, product) VALUES ${values}`)
          .bind(
            ...chunk.flatMap((product, index) => [
              at + index,
              product.sku,
              JSON.stringify(product),
            ]),
          )
          .run();
      }

      const syncedAt = new Date().toISOString();
      // The swap. One row, so a reader is looking at either the old catalog or
      // the new one and never at a mixture of the two.
      await db
        .prepare(
          `INSERT INTO ${STATE} (id, generation, synced_at) VALUES (1, ?1, ?2)
           ON CONFLICT(id) DO UPDATE SET generation = excluded.generation,
                                         synced_at = excluded.synced_at`,
        )
        .bind(next, syncedAt)
        .run();

      // Only now, when nothing can be reading them.
      await db.prepare(`DELETE FROM ${PRODUCTS} WHERE generation <> ?1`).bind(next).run();

      return cache(next, { products, syncedAt });
    },
  };
}

/**
 * Whether D1 refused because the catalog's tables are not there yet.
 *
 * Two things land here and both are ordinary. `next dev` runs against a local
 * D1 that a checkout has never migrated, and a Worker can be deployed a minute
 * before `wrangler d1 migrations apply` catches up. In both the shipped seed is
 * the honest answer, and a shop that will not open because a table is missing
 * is worse than one showing the catalog as it shipped.
 *
 * Only this one refusal is caught. Anything else D1 says is a real failure and
 * is left to fail: serving months-old prices without saying so is not a
 * recovery, it is a quieter kind of outage.
 */
function isMissingTable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause;
  const said = `${error.message} ${cause instanceof Error ? cause.message : ""}`;
  return /no such table/i.test(said);
}

/**
 * The largest generation the database has seen, counting the pointer as well as
 * the rows: a sync that died after writing its products but before moving the
 * pointer leaves rows behind, and handing its number to the next sync would
 * mean inserting on top of them.
 */
async function highestGeneration(db: Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT MAX(generation) AS generation FROM (
         SELECT generation FROM ${PRODUCTS}
         UNION ALL
         SELECT generation FROM ${STATE}
       )`,
    )
    .first<{ generation: number | null }>();
  return typeof row?.generation === "number" ? row.generation : 0;
}

/**
 * A stored product is text that came out of a database, so it is checked on the
 * way back in rather than trusted, the way a stored selection is (see
 * lib/links/store.ts). A row written by an older version of this code, or by
 * hand in the D1 console, must not be able to hand the shop something that is
 * not a product: a card with no style number has no address and no photo, and
 * dropping it is better than rendering it.
 */
function parseProduct(value: unknown): Product | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const product = parsed as Partial<Product>;
    if (typeof product.sku !== "string" || !product.sku) return null;
    if (!Array.isArray(product.images)) return null;
    return product as Product;
  } catch {
    return null;
  }
}

/**
 * Both stores are held on globalThis rather than in a module variable on
 * purpose: the page, the sync route and the image route are bundled separately,
 * so a plain module-level store would give each of them its own copy. Off
 * Cloudflare that would mean a sync never showing up on the page; on it, three
 * copies of the catalog parsed out of JSON in the same isolate.
 */
const STORE_KEY = Symbol.for("itoo.catalog.store");
const D1_KEY = Symbol.for("itoo.catalog.d1");

type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: CatalogStore;
  [D1_KEY]?: { db: Database; store: CatalogStore };
};

/** What `next dev` and the test run get: the catalog lives in this isolate only. */
function sharedMemoryStore(): CatalogStore {
  const container = globalThis as GlobalWithStore;
  container[STORE_KEY] ??= createMemoryStore();
  return container[STORE_KEY];
}

/** Kept per binding, so the parsed catalog it holds outlives one request. */
function sharedD1Store(db: Database): CatalogStore {
  const container = globalThis as GlobalWithStore;
  const held = container[D1_KEY];
  if (held?.db === db) return held.store;
  const store = createD1CatalogStore(db);
  container[D1_KEY] = { db, store };
  return store;
}

async function backingStore(): Promise<CatalogStore> {
  const db = await database();
  return db ? sharedD1Store(db) : sharedMemoryStore();
}

export const catalogStore: CatalogStore = {
  read: async () => (await backingStore()).read(),
  replace: async (products) => (await backingStore()).replace(products),
};
