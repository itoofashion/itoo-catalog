import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/catalog-view";
import { filterProducts } from "@/lib/catalog/filter";
import { parseShareQuery } from "@/lib/catalog/share";
import { catalogStore } from "@/lib/catalog/store";

// The catalog changes whenever someone syncs, so pages are rendered per request.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Client links get sent in chat apps, which unfurl them into a preview card.
 * Rendering the title, description and lead photo on the server is what makes
 * that card show the right product instead of a bare URL.
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const selection = parseShareQuery(await searchParams);
  const { products } = await catalogStore.read();
  const shown = filterProducts(products, selection, new Date());

  const title = selection.category
    ? `itoo — ${selection.category}`
    : "itoo — Wholesale Catalog";
  const description =
    selection.skus.length > 0
      ? `${shown.length} styles picked for you.`
      : `${shown.length} styles, current prices and photos.`;
  const image = shown[0]?.images[0]?.url;

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

export default async function CatalogPage({ searchParams }: PageProps) {
  const selection = parseShareQuery(await searchParams);
  const { products, syncedAt } = await catalogStore.read();

  return (
    <CatalogView
      products={products}
      syncedAt={syncedAt}
      selection={selection}
      now={new Date().toISOString()}
    />
  );
}
