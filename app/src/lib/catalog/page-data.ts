import type { Metadata } from "next";
import { headers } from "next/headers";
import { isTeamViewer } from "@/lib/admin/request";
import { categoriesOf, selectedProducts } from "./filter";
import { hiddenStyles } from "./hidden";
import { catalogMeta, productMeta, type CatalogMeta } from "./meta";
import { toPublicCatalog, type PublicProduct } from "./public";
import { NO_FILTERS, type CatalogSelection } from "./share";
import { resolveCategories } from "./slug";
import { catalogStore } from "./store";

/**
 * Shared by the catalog page, by short links and by a style's own address, all
 * of which render the same catalog.
 *
 * Everything here hands the browser the published catalog, never the stored one.
 * See lib/catalog/public.ts for what that leaves behind.
 *
 * Styles the team has hidden are dropped here, once, for every route at the same
 * time. That is the point of there being one function: hiding that had to be
 * remembered separately by the page, the short link and the product route would
 * be hiding that a new route silently opts out of.
 */
export async function publishedCatalog() {
  const [catalog, hidden, isTeam] = await Promise.all([
    catalogStore.read(),
    hiddenStyles().then((styles) => styles.list()),
    isTeamViewer(),
  ]);

  return {
    ...toPublicCatalog(catalog, new Date(), { hidden, isTeam }),
    syncedAt: catalog.syncedAt,
  };
}

/**
 * Client links get sent in chat apps, which unfurl them into a preview card.
 * Rendering the title, description and lead photo on the server is what makes
 * that card name the categories a client asked for instead of showing a bare URL.
 */
export async function catalogMetadata(
  selection: CatalogSelection,
  /** A link minted under the new-arrivals lens unfurls with the lens applied. */
  newOnly = false,
): Promise<Metadata> {
  const { products } = await publishedCatalog();
  // The address carries category slugs, and only the catalog can say which names
  // they stand for. A short link hands over the names themselves, which come
  // through this unchanged.
  const { selection: named } = resolveCategories(
    { selection, filters: NO_FILTERS },
    categoriesOf(products),
  );
  const reachable = selectedProducts(products, named);
  // The preview card counts what the link will open on, and a lensed link
  // opens on the new arrivals alone.
  const shown = newOnly ? reachable.filter((product) => product.isNew) : reachable;
  const meta = catalogMeta(named, shown.length);

  return preview(meta, shown[0]?.images[0]?.url);
}

/**
 * A link to one style, unfurled. The photograph is the one of the chosen color
 * where the style has one, so the card in the chat shows what the link opens.
 */
export async function productMetadata(
  product: PublicProduct,
  color: string | null,
): Promise<Metadata> {
  const photo = (color && product.images.find((image) => image.color === color)) || product.images[0];
  return preview(productMeta(product, color), photo?.url);
}

/** One shape for both, because a chat app reads both the same way. */
async function preview(
  { title, description }: CatalogMeta,
  photo: string | undefined,
): Promise<Metadata> {
  const image = await absoluteUrl(photo);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/**
 * Photos are served from our own domain, so their addresses are paths. A chat
 * app unfurling a link fetches the preview image from its own servers and has
 * nowhere to resolve a path against, so it is made absolute here, from the host
 * the request came in on, the only thing that knows whether this is the live
 * domain, a preview deployment or a laptop.
 */
async function absoluteUrl(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const incoming = await headers();
  const host = incoming.get("host");
  if (!host) return undefined;
  // Cloudflare always sends the header; a local dev server does not, and it is
  // the only place the catalog is ever served over plain http.
  const protocol =
    incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return new URL(path, `${protocol}://${host}`).toString();
}
