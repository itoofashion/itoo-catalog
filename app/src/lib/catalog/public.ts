import { isNewArrival } from "./arrivals";
import type { Catalog, Product, ProductImage } from "./types";

/**
 * What a browser is allowed to see.
 *
 * The catalog is served from a public address and anything handed to a page is
 * readable by whoever opens it, so the stored product and the published product
 * are deliberately different types. Everything that came out of the vendor admin
 * and is nobody else's business — FashionGo's internal product ids, the source
 * price the catalog price is derived from, when a style was created — stays in
 * the store and never crosses this boundary.
 *
 * "New arrival" is resolved here rather than shipped as a date, because the
 * badge is the only thing the interface needs from that date.
 */
export type PublicProduct = {
  sku: string;
  name: string;
  price: number;
  category: string;
  colors: string[];
  images: ProductImage[];
  isNew: boolean;
};

export type PublicCatalog = {
  products: PublicProduct[];
};

export function toPublicProduct(product: Product, now: Date): PublicProduct {
  // Written field by field on purpose: spreading the stored product would
  // publish every field a future migration happens to add to it.
  return {
    sku: product.sku,
    name: product.name,
    price: product.price,
    category: product.category,
    colors: product.colors,
    images: product.images.map((image) => ({ url: image.url, color: image.color })),
    isNew: isNewArrival(product.createdAt, now),
  };
}

export function toPublicCatalog(catalog: Catalog, now: Date): PublicCatalog {
  return { products: catalog.products.map((product) => toPublicProduct(product, now)) };
}
