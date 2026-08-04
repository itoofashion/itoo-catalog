/** A photo of a product. FashionGo tags most photos with the color they show. */
export type ProductImage = {
  /** Our own address for the photo, "/i/<key>" (see lib/images/source.ts). */
  url: string;
  /**
   * Where the photo is downloaded from the first time it is asked for. Stays in
   * the store: it is a FashionGo address, and those carry their product id.
   */
  sourceUrl: string;
  color: string | null;
};

/**
 * A product as the catalog shows it. This is the shape the app renders and the
 * shape a sync pushes to /api/sync. FashionGo's own field names never leak past
 * the mapping layer.
 */
export type Product = {
  /** Vendor style number, e.g. "Y-542". Unique within the catalog. */
  sku: string;
  name: string;
  /** Price shown to wholesale clients. */
  price: number;
  category: string;
  colors: string[];
  images: ProductImage[];
  /**
   * The size run, in the vendor's order: ["S", "M", "L"]. Empty when the vendor
   * never stated one.
   */
  sizes: string[];
  /**
   * Pieces per size, aligned with `sizes`: [2, 2, 2] against ["S", "M", "L"]
   * means a pack of two smalls, two mediums and two larges. Null when the style
   * is sold loose: the buyer picks the sizes and only the total is fixed.
   */
  packBreakdown: number[] | null;
  /** Pieces in the smallest order the vendor accepts. Null when unstated. */
  minimumUnits: number | null;
  /** ISO 8601. Drives the "New" badge. */
  createdAt: string;
  /** FashionGo's product id, kept so a product can be traced back to its source. */
  sourceId: number;
};

export type Catalog = {
  products: Product[];
  /** ISO 8601 timestamp of the last successful sync. */
  syncedAt: string;
};
