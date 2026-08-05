import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/catalog-view";
import { isTeamViewer } from "@/lib/admin/request";
import { productMetadata, publishedCatalog } from "@/lib/catalog/page-data";
import type { PublicProduct } from "@/lib/catalog/public";
import { EMPTY_SELECTION, NO_FILTERS } from "@/lib/catalog/share";
import { productSlugs, resolveSlug } from "@/lib/catalog/slug";

/**
 * One style, at an address of its own.
 *
 * Opening a style from the grid only rewrites the address, because the catalog
 * is already in the browser and rebuilding it for a dialog would be seven
 * hundred cards of work (see catalog-view.tsx). This route is the other half of
 * that: someone who was sent /p/y-542 in a chat has no catalog yet, so the page
 * is rendered here with the style already open behind it.
 */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sku: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const found = await findStyle((await params).sku, await searchParams);
  // The page itself answers 404; there is no preview to write for one.
  if (!found) return {};
  return productMetadata(found.product, found.color);
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const found = await findStyle((await params).sku, await searchParams);
  if (!found) notFound();

  return (
    <CatalogView
      products={found.products}
      selection={EMPTY_SELECTION}
      filters={NO_FILTERS}
      isTeam={await isTeamViewer()}
      openSku={found.product.sku}
      openColor={found.color}
      // Closing the style leaves the visitor in the catalog, which is at the
      // root; this route is one style of it, not a place to go back to.
      catalogPath="/"
    />
  );
}

/**
 * The style an address names, and the color it asks for. A color the style does
 * not come in is ignored rather than fatal: only the style makes the address.
 */
async function findStyle(
  slug: string,
  query: Record<string, string | string[] | undefined>,
): Promise<{
  products: PublicProduct[];
  product: PublicProduct;
  color: string | null;
} | null> {
  const { products } = await publishedCatalog();
  const sku = productSlugs(products).skuOf(slug);
  const product = sku ? products.find((item) => item.sku === sku) : undefined;
  if (!product) return null;

  const asked = query.c;
  const color = resolveSlug(Array.isArray(asked) ? asked[0] : asked, product.colors);
  return { products, product, color };
}
