import seed from "@/data/fashiongo-seed.json";
import { categoryNameMap, dedupeBySku, mapProduct } from "@/lib/fashiongo/map";
import type {
  FashionGoCategory,
  FashionGoDetail,
  FashionGoListRecord,
} from "@/lib/fashiongo/types";
import type { Catalog, Product } from "./types";

/**
 * The pilot ships with the itoo catalog as it stood at the last pull, exported
 * from FashionGo by scripts/pull-seed.mjs. It is what the site shows before
 * anyone presses Sync.
 */
export function seedProducts(): Product[] {
  const categories = categoryNameMap(seed.categories as FashionGoCategory[]);
  const products = seed.products.map((entry) =>
    mapProduct(
      entry.record as FashionGoListRecord,
      // FashionGo repeats the vendor's size and pack tables in every product's
      // detail; the seed keeps one copy and hands it back here, so the mapping
      // sees the same shape it gets from a live sync.
      entry.detail
        ? ({ ...entry.detail, size: seed.sizes, pack: seed.packs } as FashionGoDetail)
        : null,
      categories,
    ),
  );
  return dedupeBySku(products);
}

export function seedCatalog(): Catalog {
  return { products: seedProducts(), syncedAt: seed.pulledAt };
}
