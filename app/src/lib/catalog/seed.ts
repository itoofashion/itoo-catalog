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

/**
 * The vendor's categories, by id.
 *
 * FashionGo's published API names a style's categories by number and has no
 * endpoint that says what the numbers mean, so the table has to come from
 * somewhere else, and the seed already carries the vendor's own copy of it. It
 * is a list of fourteen names that changes about never, so shipping it beats
 * asking a live sync to carry it: a push that forgot the categories would file
 * the whole catalog under "Other".
 */
export function seedCategoryNames(): Map<number, string> {
  return categoryNameMap(seed.categories as FashionGoCategory[]);
}
