import type { PublicProduct } from "./public";

/** One size in the run, with the pieces of it the pack holds. */
export type PackSize = {
  /** "S" */
  label: string;
  /** Pieces of this size, or null when the vendor fixed no split. */
  units: number | null;
};

/**
 * How a style is sold.
 *
 * Wholesale is not sold by the piece: a style comes as a pack with a fixed
 * split across sizes, and that is the smallest order a buyer can place. It is
 * the first thing they check after the price, so the catalog states it rather
 * than making them ask.
 *
 * The split is printed on the sizes themselves, "S ×2 · M ×2 · L ×2", because
 * that is the question being asked: not "how many pieces in total" but "how
 * many of each size will arrive". A separate "pack 2-2-2" line left the buyer
 * matching numbers to sizes by position, which is the work the catalog is here
 * to do for them.
 */
export type PackSummary = {
  /** The size run, each size carrying its own count where one is known. */
  sizes: PackSize[];
  /** True when every size carries a count. */
  perSize: boolean;
  /** "S ×2 · M ×2 · L ×2", or "S · M · L" where no split was given. */
  run: string;
  /** "6 pcs": the smallest order, whether that comes from a pack or not. */
  minimum: string | null;
};

export function packSummary(
  product: Pick<PublicProduct, "sizes" | "packBreakdown" | "minimumUnits">,
): PackSummary | null {
  const labels = product.sizes.filter(Boolean);
  if (labels.length === 0 && !product.minimumUnits) return null;

  // A split that does not line up with the sizes cannot be pinned to them, and
  // a guess here is a wrong number against a size the buyer is about to order.
  const split =
    product.packBreakdown && product.packBreakdown.length === labels.length
      ? product.packBreakdown
      : null;

  const sizes = labels.map((label, index) => ({
    label,
    units: split ? split[index] : null,
  }));

  const run = sizes
    .map((size) => (size.units === null ? size.label : `${size.label} ×${size.units}`))
    .join(" · ");

  const minimum = product.minimumUnits ? `${product.minimumUnits} pcs` : null;

  return { sizes, perSize: split !== null, run, minimum };
}
