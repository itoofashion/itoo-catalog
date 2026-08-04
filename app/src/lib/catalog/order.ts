import { formatColorName } from "./color";
import { packSummary } from "./pack";
import { formatPrice } from "./pricing";
import type { PublicProduct } from "./public";

/**
 * What "Copy details" puts on the clipboard. Buyers paste this straight into a
 * chat, so it has to be readable as plain text and carry everything the sales
 * team needs to identify the item: style number, color and price.
 *
 * The order of the lines is the order the card and the dialog print them in.
 * Those two are the only preview the button has, so the two have to agree.
 */
export function orderText(
  product: PublicProduct,
  color: string | null,
  catalogUrl?: string,
): string {
  const lines = [product.name, `SKU: ${product.sku}`];
  if (color) lines.push(`Color: ${formatColorName(color)}`);

  // How the style is sold belongs in the message: a buyer pasting this into a
  // conversation is agreeing to a pack, not to a single piece.
  const pack = packSummary(product);
  if (pack?.sizes) {
    lines.push(`Sizes: ${pack.sizes}${pack.split ? ` (${pack.split})` : ""}`);
  }
  if (product.minimumUnits) {
    lines.push(
      `Minimum order: ${product.minimumUnits} ${product.minimumUnits === 1 ? "piece" : "pieces"}`,
    );
  }

  lines.push(`Price: ${formatPrice(product.price)} / unit`);
  if (catalogUrl) lines.push(catalogUrl);
  return lines.join("\n");
}
