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
 * the site works with no database. Milestone 2 swaps in a D1-backed store
 * behind this same interface.
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
 * Module-level so a sync survives between requests within a Worker isolate.
 * Isolates are recycled, at which point the catalog returns to the seed —
 * acceptable for the pilot, and the reason M2 moves this into D1.
 */
export const catalogStore: CatalogStore = createMemoryStore();
