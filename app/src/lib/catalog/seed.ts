import seed from "@/data/fashiongo-seed.json";
import { categoryNameMap, mapProduct } from "@/lib/fashiongo/map";
import type {
  FashionGoCategory,
  FashionGoDetail,
  FashionGoListRecord,
} from "@/lib/fashiongo/types";
import type { Catalog, Product } from "./types";

/**
 * The pilot ships with a real slice of the itoo catalog, pulled from FashionGo by
 * scripts/pull-seed.mjs. It is what the site shows before anyone presses Sync.
 */
export function seedProducts(): Product[] {
  const categories = categoryNameMap(seed.categories as FashionGoCategory[]);
  return seed.products.map((entry) =>
    mapProduct(
      entry.record as FashionGoListRecord,
      entry.detail as FashionGoDetail,
      categories,
    ),
  );
}

export function seedCatalog(): Catalog {
  return { products: seedProducts(), syncedAt: seed.pulledAt };
}
