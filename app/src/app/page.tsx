import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/catalog-view";
import { isTeamViewer } from "@/lib/admin/request";
import { categoriesOf } from "@/lib/catalog/filter";
import { catalogMetadata, publishedCatalog } from "@/lib/catalog/page-data";
import { parseCatalogQuery } from "@/lib/catalog/share";
import { resolveCategories } from "@/lib/catalog/slug";

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
  const { products } = await publishedCatalog();
  // Categories travel as slugs, because "Jumpsuits & Rompers" in an address is a
  // run of percent signs. Only the catalog knows which name a slug stands for,
  // and an address written before slugs carries the name itself and still opens.
  const { selection, filters } = resolveCategories(
    parseCatalogQuery(await searchParams),
    categoriesOf(products),
  );

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
