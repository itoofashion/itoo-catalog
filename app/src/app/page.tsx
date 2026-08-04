import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/catalog-view";
import { isTeamViewer } from "@/lib/admin/request";
import { catalogMetadata, publishedCatalog } from "@/lib/catalog/page-data";
import { parseCatalogQuery } from "@/lib/catalog/share";

// The catalog changes whenever someone syncs, so pages are rendered per request.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { selection } = parseCatalogQuery(await searchParams);
  return catalogMetadata(selection);
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const { selection, filters } = parseCatalogQuery(await searchParams);
  const { products } = await publishedCatalog();

  return (
    <CatalogView
      products={products}
      selection={selection}
      filters={filters}
      // The same address for everyone: the team gets their tools on top of it,
      // a client gets the catalog. Decided here because a browser cannot be
      // asked to answer this honestly.
      isTeam={await isTeamViewer()}
    />
  );
}
