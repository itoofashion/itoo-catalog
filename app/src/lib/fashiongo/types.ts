/** The subset of FashionGo's payloads the catalog actually relies on. */

export type FashionGoListRecord = {
  productId: number;
  /** FashionGo's "product name" is the vendor style number, e.g. "Y-542". */
  productName: string;
  /** The human-readable name, e.g. "Romantic Lace Top". */
  itemName: string | null;
  sellingPrice: number | null;
  _unitPrice?: number | null;
  imageUrl: string | null;
  /** When the vendor uploaded the style — it may sit unpublished for weeks after. */
  _createdOn: string;
  /** When the style went live for buyers. This is the date the admin shows. */
  _activatedOn?: string | null;
  /** Points into the vendor's size table, e.g. 18988 = "S;M;L". */
  sizeId?: number | null;
  /** Points into the vendor's pack table. Null (or 0) means the style is sold loose. */
  packId?: number | null;
  active: boolean;
};

export type FashionGoImage = {
  imageUrl: string;
  color: string | null;
  listOrder: number;
  active: boolean;
};

/**
 * A row of the vendor's size table. `sizeName` is free text the vendor can put
 * anything in (some rows hold obvious junk), so the run is read from
 * `sizeDescription2`, which is what FashionGo's own admin splits on ";".
 */
export type FashionGoSize = {
  sizeId: number;
  sizeDescription2: string | null;
  /** Number of sizes in the run. A pack fits a size run when its count matches. */
  sizeQtyCount?: number | null;
};

/** A row of the vendor's pack table: `packDescription` is "2-2-2" — the split. */
export type FashionGoPack = {
  packId: number;
  packDescription: string | null;
  packQtyCount?: number | null;
};

export type FashionGoDetail = {
  item: {
    productId: number;
    /** Products carry a leaf category; its parent is the one shoppers recognise. */
    categoryId: number | null;
    parentCategoryId: number | null;
    parentParentCategoryId: number | null;
    sizeId?: number | null;
    packId?: number | null;
    /** Smallest number of pieces the vendor will sell of this style. */
    minTQStyle?: number | null;
  };
  image: FashionGoImage[] | null;
  /**
   * The vendor's whole size and pack tables, not this product's values —
   * FashionGo sends them with every detail because the admin's edit form needs
   * them as dropdowns. The product's own run is the row matching `item.sizeId`.
   */
  size?: FashionGoSize[] | null;
  pack?: FashionGoPack[] | null;
};

export type FashionGoCategory = {
  catID: number;
  /** Arrives with a product count appended, e.g. "Tops (299) ". */
  catName: string;
};
