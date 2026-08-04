/**
 * Catalog prices are the FashionGo price minus a fixed discount, agreed with the
 * client. Kept in one place so a future change is a one-line edit.
 */
export const PRICE_DISCOUNT_USD = 1;

/** Money is rounded to cents; floats accumulate error otherwise (20.75 - 1 → 19.749999). */
export function catalogPrice(fashionGoPrice: number): number {
  if (!Number.isFinite(fashionGoPrice)) {
    throw new Error(`Invalid FashionGo price: ${fashionGoPrice}`);
  }
  const discounted = Math.max(0, fashionGoPrice - PRICE_DISCOUNT_USD);
  return Math.round(discounted * 100) / 100;
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}
