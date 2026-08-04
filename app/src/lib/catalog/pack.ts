import type { PublicProduct } from "./public";

/**
 * How a style is sold.
 *
 * Wholesale is not sold by the piece: a style comes as a pack with a fixed
 * split across sizes — two smalls, two mediums, two larges — and that is the
 * smallest order a buyer can place. It is the first thing they check after the
 * price, so the catalog states it rather than making them ask.
 */
export type PackSummary = {
  /** "S · M · L" */
  sizes: string;
  /** "pack 2-2-2", or null when the vendor did not fix a split. */
  split: string | null;
  /** "6 pcs" — the smallest order, whether that comes from a pack or not. */
  minimum: string | null;
};

export function packSummary(
  product: Pick<PublicProduct, "sizes" | "packBreakdown" | "minimumUnits">,
): PackSummary | null {
  const sizes = product.sizes.filter(Boolean);
  if (sizes.length === 0 && !product.minimumUnits) return null;

  const split =
    product.packBreakdown && product.packBreakdown.length === sizes.length
      ? `pack ${product.packBreakdown.join("-")}`
      : null;

  const minimum = product.minimumUnits ? `${product.minimumUnits} pcs` : null;

  return { sizes: sizes.join("·"), split, minimum };
}
