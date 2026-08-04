import type { Metadata } from "next";
import { headers } from "next/headers";
import { selectedProducts } from "./filter";
import { catalogMeta } from "./meta";
import { toPublicCatalog } from "./public";
import type { CatalogSelection } from "./share";
import { catalogStore } from "./store";

/**
 * Shared by the catalog page and by short links, which render the same catalog
 * under a different address.
 *
 * Everything here hands the browser the published catalog, never the stored one.
 * See lib/catalog/public.ts for what that leaves behind.
 */
export async function publishedCatalog() {
  const catalog = await catalogStore.read();
  return {
    ...toPublicCatalog(catalog, new Date()),
    syncedAt: catalog.syncedAt,
  };
}

/**
 * Client links get sent in chat apps, which unfurl them into a preview card.
 * Rendering the title, description and lead photo on the server is what makes
 * that card name the categories a client asked for instead of showing a bare URL.
 */
export async function catalogMetadata(selection: CatalogSelection): Promise<Metadata> {
  const { products } = await publishedCatalog();
  const shown = selectedProducts(products, selection);
  const { title, description } = catalogMeta(selection, shown.length);
  const image = await absoluteUrl(shown[0]?.images[0]?.url);

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
