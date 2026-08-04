/** A photo of a product. FashionGo tags most photos with the color they show. */
export type ProductImage = {
  url: string;
  color: string | null;
};

/**
 * A product as the catalog shows it. This is the shape the app renders and the
 * shape the Chrome extension pushes to /api/sync — FashionGo's own field names
 * never leak past the mapping layer.
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
  /** ISO 8601. Drives the "New" badge. */
  createdAt: string;
  /** FashionGo's product id — kept so a product can be traced back to its source. */
  sourceId: number;
};

export type Catalog = {
  products: Product[];
  /** ISO 8601 timestamp of the last successful sync. */
  syncedAt: string;
};
