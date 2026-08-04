import { seedCatalog } from "./seed";
import type { Catalog, Product } from "./types";

/**
 * Where the live catalog lives.
 *
 * Sync is a full replacement: whatever the extension pushes becomes the catalog,
 * exactly as it stands in FashionGo. There is no merge or conflict handling by
 * design — FashionGo is the source of truth.
 *
 * The pilot keeps the catalog in memory and falls back to the shipped seed, so
 * the site works with no database. Milestone 2 swaps in a D1-backed store behind
 * this same interface.
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

/**
 * Held on globalThis rather than in a module variable on purpose: the page and
 * the sync route are bundled separately, so a plain module-level store would
 * give each of them its own copy and a sync would never show up on the page.
 *
 * The catalog still lives only in this isolate's memory. When the isolate is
 * recycled the catalog returns to the seed — acceptable for the pilot, and the
 * reason Milestone 2 moves this into D1.
 */
const STORE_KEY = Symbol.for("itoo.catalog.store");

type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: CatalogStore };

function sharedStore(): CatalogStore {
  const container = globalThis as GlobalWithStore;
  container[STORE_KEY] ??= createMemoryStore();
  return container[STORE_KEY];
}

export const catalogStore: CatalogStore = {
  read: () => sharedStore().read(),
  replace: (products) => sharedStore().replace(products),
};
