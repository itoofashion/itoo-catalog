import { formatColorName } from "./color";
import { formatPrice } from "./pricing";
import type { PublicProduct } from "./public";
import { isEmptySelection, type CatalogSelection } from "./share";

/**
 * What a chat app shows when the link is pasted.
 *
 * This is the first thing a wholesale client sees, often before they open
 * anything, so it says what is inside rather than repeating the brand: the
 * categories they asked for, and how many styles are waiting.
 */
export type CatalogMeta = { title: string; description: string };

const BRAND = "itoo";

export function catalogMeta(
  selection: CatalogSelection,
  shownCount: number,
): CatalogMeta {
  const styles = `${shownCount} ${shownCount === 1 ? "style" : "styles"}`;

  if (selection.categories.length > 0) {
    const named = listNames(selection.categories);
    const extra =
      selection.skus.length > 0
        ? ` and ${selection.skus.length} more ${selection.skus.length === 1 ? "style" : "styles"}`
        : "";
    return {
      title: `${BRAND} · ${named}`,
      description: `${styles} in ${named}${extra}, with current prices and photos.`,
    };
  }

  if (selection.skus.length > 0) {
    return {
      title: `${BRAND} · ${styles} for you`,
      description: `A selection of ${styles}, with current prices and photos.`,
    };
  }

  if (isEmptySelection(selection)) {
    return {
      title: `${BRAND} · Wholesale Catalog`,
      description: `${styles}, with current prices and photos.`,
    };
  }

  return { title: BRAND, description: `${styles}.` };
}

/**
 * What a chat app shows when a link to one style is pasted.
 *
 * A style is sent to a buyer on its own far more often than the whole catalog
 * is, and the preview card is the sales pitch: the name, the style number the
 * order will be placed under, the price per unit and the color that was chosen.
 * The photograph comes from the page, which is the only place that knows how to
 * make an address absolute.
 */
export function productMeta(product: PublicProduct, color: string | null): CatalogMeta {
  const chosen = color ? ` · ${formatColorName(color)}` : "";
  return {
    title: `${BRAND} · ${product.name}`,
    description: `${product.sku} · ${formatPrice(product.price)} per unit${chosen}, with photos and pack details.`,
  };
}

/** "Dresses", "Dresses and Tops", "Dresses, Tops and Pants". */
function listNames(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
