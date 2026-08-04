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
  _createdOn: string;
  active: boolean;
};

export type FashionGoImage = {
  imageUrl: string;
  color: string | null;
  listOrder: number;
  active: boolean;
};

export type FashionGoDetail = {
  item: {
    productId: number;
    /** Products carry a leaf category; its parent is the one shoppers recognise. */
    categoryId: number | null;
    parentCategoryId: number | null;
    parentParentCategoryId: number | null;
  };
  image: FashionGoImage[] | null;
};

export type FashionGoCategory = {
  catID: number;
  /** Arrives with a product count appended, e.g. "Tops (299) ". */
  catName: string;
};
