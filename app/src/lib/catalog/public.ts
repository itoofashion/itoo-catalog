import { isNewArrival } from "./arrivals";
import type { Catalog, Product } from "./types";

/**
 * What a browser is allowed to see.
 *
 * The catalog is served from a public address and anything handed to a page is
 * readable by whoever opens it, so the stored product and the published product
 * are deliberately different types. Everything that came out of the vendor admin
 * and is nobody else's business (FashionGo's internal product ids, the source
 * price the catalog price is derived from, when a style was created) stays in
 * the store and never crosses this boundary.
 *
 * "New arrival" is resolved here rather than shipped as a date, because the
 * badge is the only thing the interface needs from that date.
 */
/** A photo as the browser gets it: an address of ours, and what color it shows. */
export type PublicImage = {
  url: string;
  color: string | null;
};

export type PublicProduct = {
  sku: string;
  name: string;
  price: number;
  category: string;
  colors: string[];
  images: PublicImage[];
  /**
   * What a wholesale buyer has to know before ordering: which sizes come in the
   * pack, how many of each, and how many pieces that adds up to. None of it says
   * anything about the vendor's own numbers, so all three are published.
   */
  sizes: string[];
  packBreakdown: number[] | null;
  minimumUnits: number | null;
  isNew: boolean;
  /**
   * The day the style went on sale, ISO 8601. In the team's copy only, for their
   * filter by date: the badge is all a client's page needs from this date, and
   * publishing the date itself to everyone is what this boundary exists to stop.
   */
  addedAt?: string;
  /**
   * Taken out of the catalog by the team. Only ever true in the team's own copy:
   * a hidden style is dropped from a client's catalog entirely rather than sent
   * with a flag on it, so a client's page never contains one to un-flag. What
   * this field is for is the team's view, where the card has to stay on screen,
   * dimmed and labelled, or there would be nowhere to press to bring it back.
   */
  isHidden: boolean;
};

export type PublicCatalog = {
  products: PublicProduct[];
};

/**
 * Who this catalog is being published to, which is the whole of what decides
 * whether a hidden style is in it.
 */
export type Visibility = {
  /** Style numbers the team has hidden. See lib/catalog/hidden.ts. */
  hidden: ReadonlySet<string>;
  /** Whether the page being built is for a signed-in team member. */
  isTeam: boolean;
};

export function toPublicProduct(
  product: Product,
  now: Date,
  isHidden = false,
  forTeam = false,
): PublicProduct {
  // Written field by field on purpose: spreading the stored product would
  // publish every field a future migration happens to add to it.
  return {
    // Left out entirely rather than nulled for a client, so the client's
    // payload carries no trace of there being a date to ask about.
    ...(forTeam ? { addedAt: product.createdAt } : {}),
    sku: product.sku,
    name: product.name,
    price: product.price,
    category: product.category,
    colors: product.colors,
    // A photo is published as our own address and its color. Where we download
    // it from is a FashionGo address with their product id in the filename, and
    // hiding that is the whole point of serving photos ourselves.
    images: product.images.map((image) => ({ url: image.url, color: image.color })),
    sizes: product.sizes,
    packBreakdown: product.packBreakdown,
    minimumUnits: product.minimumUnits,
    isNew: isNewArrival(product.createdAt, now),
    isHidden,
  };
}

/**
 * The catalog as a browser gets it.
 *
 * This is where hiding actually happens, and it happens here rather than in the
 * grid on purpose: a card the interface declines to draw has still been sent to
 * the browser, sitting in the page's payload for anyone who looks, which would
 * make the eye a decoration rather than a control. Dropped here, a hidden style
 * is not in the markup, not in the count above the grid, not in the preview a
 * chat app unfurls, and not findable at its own address.
 *
 * The team gets it whole, with the hidden ones marked. They have to: the card is
 * the only place to press to bring a style back.
 */
export function toPublicCatalog(
  catalog: Catalog,
  now: Date,
  visibility: Visibility,
): PublicCatalog {
  const products = catalog.products
    .filter((product) => visibility.isTeam || !visibility.hidden.has(product.sku))
    .map((product) =>
      toPublicProduct(product, now, visibility.hidden.has(product.sku), visibility.isTeam),
    );
  return { products };
}

/** What a client sees when nothing has been hidden. Handy in tests. */
export const NOTHING_HIDDEN: Visibility = { hidden: new Set(), isTeam: false };
